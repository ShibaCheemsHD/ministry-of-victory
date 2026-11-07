"""The weekly retraining of the chance model (the self-learning loop, .github/workflows/learn.yml).

1. The recipe is checked on what it has not seen: it is fitted on everything up to 65 days ago and scored on the
   last 60 days (the 5 days between keep the training labels from looking into the test days), against the
   engine's own forecast turned into a chance (a logistic curve on forecast / deadline, fitted on the same days),
   and against the model in use on the days that model has not seen either.
2. The settings (a few, all small and monotone) are picked by 5-fold cross-validation grouped by planet.
3. Only if the check passes: refit on everything, export the trees and a parity fixture for verify.mjs.

Usage: python3 retrain.py FEAT_CSV CURRENT_MODEL_JSON OUT_DIR [--force]
Writes OUT_DIR/report.json always, and OUT_DIR/chance-model.json + OUT_DIR/fixture.json when a model is adopted.
Exit code 0 either way; the report says what was decided and why.
"""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import json, time, numpy as np, pandas as pd, warnings
warnings.filterwarnings('ignore')
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold
from common import prep, at

FEAT_CSV, CUR, OUT = sys.argv[1:4]
FORCE = '--force' in sys.argv
os.makedirs(OUT, exist_ok=True)
FEAT = ['lH', 'r_ours', 'r_line1', 'r_line6', 'l_left', 'l_share', 'd_share6', 'd_share24', 'l_regen', 'pace1', 'pace6', 'pace24', 'mo_f', 'dss']
MONO = [1 if f == 'lH' else -1 if f in ('r_ours', 'r_line1', 'r_line6') else 0 for f in FEAT]
HS = [6, 12, 18, 24, 36, 48, 72, 96, 120]
GRID = [dict(max_depth=3, learning_rate=0.08, max_iter=100, min_samples_leaf=60),
        dict(max_depth=3, learning_rate=0.08, max_iter=150, min_samples_leaf=60),
        dict(max_depth=3, learning_rate=0.05, max_iter=200, min_samples_leaf=120),
        dict(max_depth=4, learning_rate=0.08, max_iter=100, min_samples_leaf=100)]
DAY = 86400e3
HOLD, GAP = 60 * DAY, 5 * DAY
MIN_TEST, MIN_FRESH, MIN_NEW = 1000, 500, 7 * DAY
TOL = 0.005   # the new recipe may be this much worse than the model in use (Brier) on days neither has seen

report = {'ran': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'adopted': False}
def done(reason):
    report['reason'] = reason
    json.dump(report, open(os.path.join(OUT, 'report.json'), 'w'), indent=1)
    print(reason); sys.exit(0)

df = prep(FEAT_CSV)
dummy = type('M', (), {'predict_proba': lambda s, X: np.zeros((len(X), 2))})()
pairs = pd.concat([at(df, H, dummy, FEAT) for H in HS], ignore_index=True)
tmax = float(df.t.max())
report.update(rows=int(len(df)), pairs=int(len(pairs)), dataEnd=tmax, planets=int(df.planet.nunique()))

cur = json.load(open(CUR))
cur_end = float((cur.get('meta') or {}).get('dataEnd') or 0)
report['current'] = {'trained': (cur.get('meta') or {}).get('trained'), 'dataEnd': cur_end or None}
if not FORCE and cur_end and tmax - cur_end < MIN_NEW:
    done(f'not enough new data: {(tmax - cur_end) / DAY:.1f} days since the model in use (needs 7)')

def tree_predict(m, X):
    """The model JSON evaluated exactly as src/engine.js chanceOf does."""
    X = X.astype(float); s = np.full(len(X), m['base'], dtype=float)
    for tr in m['trees']:
        idx = np.zeros(len(X), dtype=int); leaf = np.zeros(len(X), dtype=bool); val = np.zeros(len(X))
        for _ in range(64):
            if leaf.all(): break
            for j in np.unique(idx[~leaf]):
                n = tr[j]; sel = (idx == j) & ~leaf
                if len(n) == 1: val[sel] = n[0]; leaf[sel] = True; continue
                v = X[sel, n[0]]
                nxt = np.where(np.isnan(v), n[2] if n[4] else n[3], np.where(v <= n[1], n[2], n[3]))
                idx[sel] = nxt
        s += val
    return 1 / (1 + np.exp(-s))

def brier(p, y): return float(np.mean((p - y) ** 2))
def scores(d, p):
    out = {'all': brier(p, d.lab.values)}
    for H in (24, 48, 72):
        m = (d.H == H).values
        if m.sum() >= 50: out[str(H)] = brier(p[m], d.lab.values[m])
    out['right'] = float(np.mean((p >= .5) == (d.lab.values == 1)))
    return {k: round(v, 4) for k, v in out.items()}

def pick(train):
    best = None
    for c in GRID:
        ll = []
        for a, b in GroupKFold(5).split(train, groups=train.planet):
            g = HistGradientBoostingClassifier(**c, l2_regularization=1.0, monotonic_cst=MONO, random_state=0).fit(train[FEAT].iloc[a], train.lab.iloc[a])
            p = np.clip(g.predict_proba(train[FEAT].iloc[b])[:, 1], 1e-4, 1 - 1e-4); y = train.lab.iloc[b].values
            ll.append(-(y * np.log(p) + (1 - y) * np.log(1 - p)).mean())
        if best is None or np.mean(ll) < best[0]: best = (float(np.mean(ll)), c)
    return best

# 1. the check on unseen days
cut = tmax - HOLD
train, test = pairs[pairs.t < cut - GAP], pairs[pairs.t >= cut]
report['holdout'] = {'from': cut, 'to': tmax, 'pairs': int(len(test))}
if len(test) < MIN_TEST: done(f'too few recent cases to check a new model on: {len(test)} (needs {MIN_TEST})')
cv, cfg = pick(train)
cand = HistGradientBoostingClassifier(**cfg, l2_regularization=1.0, monotonic_cst=MONO, random_state=0).fit(train[FEAT], train.lab)
p_new = cand.predict_proba(test[FEAT])[:, 1]
p_eng = np.zeros(len(test))
for H in HS:   # the engine's forecast as a chance, per deadline
    a, b = (train.H == H).values, (test.H == H).values
    if b.any(): p_eng[b] = LogisticRegression().fit(train.loc[a, ['r_ours']], train.lab[a]).predict_proba(test.loc[b, ['r_ours']])[:, 1]
report['holdout'].update(config=cfg, cvLogloss=round(cv, 4), new=scores(test, p_new), engine=scores(test, p_eng))
fresh = test[test.t > cur_end] if cur_end else test.iloc[:0]
if len(fresh) >= MIN_FRESH:
    pf_new = cand.predict_proba(fresh[FEAT])[:, 1]
    pf_cur = tree_predict(cur, fresh[FEAT].values)
    report['holdout']['fresh'] = {'pairs': int(len(fresh)), 'new': scores(fresh, pf_new), 'current': scores(fresh, pf_cur)}
h = report['holdout']
if not h['new']['all'] < h['engine']['all']: done('the new model is not better than the forecast alone on the last 60 days: kept the model in use')
if '48' in h['new'] and '48' in h['engine'] and not h['new']['48'] < h['engine']['48']: done('the new model is not better than the forecast alone 2 days out: kept the model in use')
if 'fresh' in h and h['fresh']['new']['all'] > h['fresh']['current']['all'] + TOL:
    done('the new model is worse than the one in use on days neither has seen: kept the model in use')

# 2-3. settings on everything, refit, export
cv_all, cfg_all = pick(pairs)
m = HistGradientBoostingClassifier(**cfg_all, l2_regularization=1.0, monotonic_cst=MONO, random_state=0).fit(pairs[FEAT], pairs.lab)
trees = []
for (pr,) in m._predictors:
    trees.append([[float(n['value'])] if n['is_leaf'] else [int(n['feature_idx']), float(n['num_threshold']), int(n['left']), int(n['right']), int(n['missing_go_to_left'])] for n in pr.nodes])
meta = {'trained': report['ran'][:10], 'dataEnd': tmax, 'rows': int(len(df)), 'pairs': int(len(pairs)), 'config': cfg_all, 'holdout': h, 'source': 'retrain'}
model = {'meta': meta, 'feat': FEAT, 'base': float(m._baseline_prediction.ravel()[0]), 'trees': trees}
# the exported trees must give sklearn's own answer
chk = pairs.sample(min(3000, len(pairs)), random_state=1)
gap = float(np.max(np.abs(tree_predict(model, chk[FEAT].values) - m.predict_proba(chk[FEAT])[:, 1])))
if gap > 1e-6: done(f'the exported trees do not match the fitted model (gap {gap:.2e}): nothing published')
json.dump(model, open(os.path.join(OUT, 'chance-model.json'), 'w'), separators=(',', ':'))
rng = np.random.default_rng(3); idx = rng.choice(len(pairs), 60, replace=False)
fx = [{'x': [None if pd.isna(v) else float(v) for v in pairs.iloc[i][FEAT].values], 'p': float(m.predict_proba(pairs.iloc[[i]][FEAT])[:, 1][0])} for i in idx]
json.dump(fx, open(os.path.join(OUT, 'fixture.json'), 'w'))
report.update(adopted=True, config=cfg_all, trees=len(trees), bytes=os.path.getsize(os.path.join(OUT, 'chance-model.json')))
done(f'new model: {len(trees)} trees, depth {cfg_all["max_depth"]}, from {len(df)} cases up to {time.strftime("%Y-%m-%d", time.gmtime(tmax / 1000))}')
