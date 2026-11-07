"""Which forecast of a planet's fall is best? Fit on 2024-25, judged on 2026 only.

Question asked of every model, at every row: will this planet fall within 24 / 48 / 72 hours?
(the verdict a Major Order needs), plus: when does it fall (for the rows that fell within 4 days).
Scores: accuracy, false wins, Brier score and log loss of the probability, calibration, time error.
Usage: python3 -I model.py feat.csv
"""
import sys, json, numpy as np, pandas as pd, warnings
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import GroupKFold
import xgboost as xgb
warnings.filterwarnings('ignore')
df = pd.read_csv(sys.argv[1])
HZ = [24, 48, 72]
L = lambda x: np.log(np.clip(x, 0.05, 1e4))

# features: what was known at the time
df['l_left'] = L(df.left); df['l_eta_ours'] = L(df.eta_ours)
df['l_eta_line1'] = L(df.eta_line1.fillna(1e4)); df['l_eta_line6'] = L(df.eta_line6.fillna(1e4))
df['line1_na'] = df.eta_line1.isna().astype(int)
df['l_share'] = L(df.share); df['d_share6'] = df.share - df.share6; df['d_share24'] = df.share - df.share24
df['l_regen'] = np.log1p(df.regen * 100)
for w in [1, 3, 6, 12, 24]: df[f'need_vs_pace{w}'] = df[f'pace{w}'] / (df.left / 48)   # pace against what 48 h would need
df['l_age'] = np.log1p(df.age)
df['mo_f'] = df.mo.fillna(-1); df['mo_left_f'] = L(df.mo_left.fillna(1e4))
df['hs'] = np.sin(df.hour / 24 * 2 * np.pi); df['hc'] = np.cos(df.hour / 24 * 2 * np.pi)
FEAT = ['l_left', 'l_eta_ours', 'l_eta_line1', 'l_eta_line6', 'line1_na', 'l_share', 'd_share6', 'd_share24', 'l_regen',
        'pace1', 'pace3', 'pace6', 'pace12', 'pace24', 'need_vs_pace6', 'need_vs_pace24', 'l_age', 'mo_f', 'mo_left_f', 'dss', 'hs', 'hc', 'dow']

def label(d, h):
    y = np.where(d.y.notna(), (d.y <= h).astype(float), np.where(d.cens >= h, 0.0, np.nan))
    return y
tr, te = df[df.test == 0].copy(), df[df.test == 1].copy()
groups = tr.planet.values

def scores(p, y):
    m = ~np.isnan(y); p, y = np.clip(p[m], 1e-4, 1 - 1e-4), y[m]
    pred = p >= 0.5
    return dict(n=int(m.sum()), acc=float((pred == y).mean()), fw=float((pred & (y == 0)).mean()), mw=float((~pred & (y == 1)).mean()),
                brier=float(((p - y) ** 2).mean()), ll=float(-(y * np.log(p) + (1 - y) * np.log(1 - p)).mean()))

res = {}
def record(name, probs_te):
    out = {}
    for h in HZ:
        out[h] = scores(probs_te[h], label(te, h))
    res[name] = out

# 1. hard baselines turned into probabilities the fair way: a logistic curve on log(eta / h), fitted on 2024-25
def eta_model(col):
    pr = {}
    for h in HZ:
        y = label(tr, h); m = ~np.isnan(y)
        x = (L(tr[col]) - np.log(h)).values.reshape(-1, 1)
        lr = LogisticRegression().fit(x[m], y[m])
        pr[h] = lr.predict_proba((L(te[col]) - np.log(h)).values.reshape(-1, 1))[:, 1]
    return pr
te['eta_geo'] = np.sqrt(te.eta_ours * te.eta_line1.fillna(1e4)); tr['eta_geo'] = np.sqrt(tr.eta_ours * tr.eta_line1.fillna(1e4))
for col, name in [('eta_ours', 'Our engine today'), ('eta_line1', 'Straight line 1 h (Companion-like)'), ('eta_geo', 'Average of the two')]:
    tr[col] = tr[col].fillna(1e4); te[col] = te[col].fillna(1e4)
    record(name, eta_model(col))
# the raw hard verdicts too (what the site shows today: eta <= h)
for col, name in [('eta_ours', 'Our engine today, hard'), ('eta_line1', 'Straight line 1 h, hard')]:
    record(name, {h: (te[col] <= h).astype(float).values for h in HZ})

# 2. logistic regression per horizon on all features
Xtr, Xte = tr[FEAT].fillna(0), te[FEAT].fillna(0)
mu, sd = Xtr.mean(), Xtr.std().replace(0, 1)
pr = {}
for h in HZ:
    y = label(tr, h); m = ~np.isnan(y)
    lr = LogisticRegression(C=0.3, max_iter=4000).fit(((Xtr - mu) / sd)[m], y[m])
    pr[h] = lr.predict_proba((Xte - mu) / sd)[:, 1]
record('Logistic regression, all features', pr)

# 3. gradient boosting per horizon (handles missing values itself), tuned by grouped CV on 2024-25
best = {}
pr = {}
for h in HZ:
    y = label(tr, h); m = ~np.isnan(y)
    X, Y, G = tr[FEAT][m], y[m], groups[m]
    cands = [dict(max_depth=d, learning_rate=lr, max_iter=it, l2_regularization=1.0, min_samples_leaf=40) for d in [3, 4] for lr in [0.05] for it in [150, 300]]
    bestll, bestc = 9, None
    for c in cands:
        ll = []
        for a, b in GroupKFold(5).split(X, Y, G):
            g = HistGradientBoostingClassifier(**c).fit(X.iloc[a], Y[a]); p = np.clip(g.predict_proba(X.iloc[b])[:, 1], 1e-4, 1 - 1e-4)
            ll.append(-(Y[b] * np.log(p) + (1 - Y[b]) * np.log(1 - p)).mean())
        if np.mean(ll) < bestll: bestll, bestc = np.mean(ll), c
    best[h] = bestc
    pr[h] = HistGradientBoostingClassifier(**bestc).fit(X, Y).predict_proba(te[FEAT])[:, 1]
record('Gradient boosting per horizon', pr)

# 4. survival model with censoring (XGBoost AFT, log-normal): one model for every horizon, and a time
lo = np.where(tr.y.notna(), tr.y, tr.cens).clip(0.05); hi = np.where(tr.y.notna(), tr.y, np.inf).clip(0.05)
dtr = xgb.DMatrix(tr[FEAT], label_lower_bound=lo, label_upper_bound=hi)
bestaft = None
for sigma in [0.6, 0.9, 1.2]:
    for depth in [3, 4]:
        params = dict(objective='survival:aft', aft_loss_distribution='normal', aft_loss_distribution_scale=sigma, max_depth=depth, eta=0.05, min_child_weight=20, subsample=0.8, colsample_bytree=0.8, eval_metric='aft-nloglik', seed=1)
        cv = xgb.cv(params, dtr, num_boost_round=600, nfold=5, early_stopping_rounds=40, seed=1, folds=list(GroupKFold(5).split(tr, groups=groups)))
        sc = cv['test-aft-nloglik-mean'].min()
        if bestaft is None or sc < bestaft[0]: bestaft = (sc, params, len(cv))
_, params, rounds = bestaft
aft = xgb.train(params, dtr, num_boost_round=rounds)
from scipy.stats import norm
mu_te = aft.predict(xgb.DMatrix(te[FEAT]), output_margin=True)   # log-time location
sig = params['aft_loss_distribution_scale']
record('Survival model (XGBoost AFT)', {h: norm.cdf((np.log(h) - mu_te) / sig) for h in HZ})

# time accuracy on the 2026 rows that fell within 4 days
f = te.y.notna() & (te.y <= 96)
def tacc(eta): e = np.abs(np.log(np.clip(eta, 0.05, 1e4) / te.y)); return float((e[f] <= np.log(1.25)).mean()), float(np.median(np.abs(np.clip(eta, 0, 1e4) - te.y)[f]))
times = {'Our engine today': tacc(te.eta_ours.values), 'Straight line 1 h (Companion-like)': tacc(te.eta_line1.values), 'Average of the two': tacc(te.eta_geo.values),
         'Survival model (XGBoost AFT)': tacc(np.exp(mu_te))}

print(f'train {len(tr)} rows (2024-25), test {len(te)} rows (2026); AFT sigma {sig}, depth {params["max_depth"]}, {rounds} rounds; GB {best}')
print(f'{"model":38s} | ' + ' | '.join(f'{h}h acc  fw   Brier  logloss' for h in HZ))
for name, out in res.items():
    print(f'{name:38s} | ' + ' | '.join(f'{out[h]["acc"]*100:5.1f} {out[h]["fw"]*100:4.1f} {out[h]["brier"]:.3f} {out[h]["ll"]:.3f}' for h in HZ))
print('time of the fall, 2026 rows that fell within 4 days (n=%d): within 25%% / median miss (h)' % f.sum())
for k, (a, m) in times.items(): print(f'  {k:38s} {a*100:5.1f}%  {m:5.1f} h')
json.dump(res, open('model_res.json', 'w'), indent=1)
aft.save_model('aft.json')
