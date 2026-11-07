"""Two checks before trusting the model.
1. Against the rule the site really uses: "On track" only when the slow end of the engine's range is in time.
   The model says On track when P >= tau, tau chosen on 2024-25 so it is right as often as the engine's
   rule there; on 2026 we compare how often each is right and how many wins each calls.
2. Uncertainty: bootstrap over planets (2026), Brier difference engine vs model, 95% interval.
Usage: python3 -I check.py feat.csv model2_lean.pkl
"""
import sys, pickle, numpy as np, pandas as pd, warnings
warnings.filterwarnings('ignore')
sys.path.insert(0, '.')
df = pd.read_csv(sys.argv[1]); model, FEAT = pickle.load(open(sys.argv[2], 'rb'))
L = lambda x: np.log(np.clip(x, 0.05, 1e4))
df['eta_line1'] = df.eta_line1.fillna(1e4); df['eta_line6'] = df.eta_line6.fillna(1e4)
df['l_left'] = L(df.left); df['l_share'] = L(df.share)
df['d_share6'] = (df.share - df.share6).fillna(0); df['d_share24'] = (df.share - df.share24).fillna(0)
df['l_regen'] = np.log1p(df.regen * 100); df['mo_f'] = df.mo.fillna(-1)
df['hs'] = np.sin(df.hour / 24 * 2 * np.pi); df['hc'] = np.cos(df.hour / 24 * 2 * np.pi)
# the engine's band, as in src/engine.js fallBand
def band_hi(eta):
    return np.where(eta < 8, eta * 1.98, np.where(eta < 16, eta * 1.83, eta * 1.52))
def at(d, H):
    e = d.copy(); e['H'] = H; e['lH'] = np.log(H)
    e['r_ours'] = L(d.eta_ours) - np.log(H); e['r_line1'] = L(d.eta_line1) - np.log(H); e['r_line6'] = L(d.eta_line6) - np.log(H)
    e['r_mo'] = np.where(d.mo_left.notna(), L(d.mo_left) - np.log(H), 9)
    e['lab'] = np.where(d.y.notna(), (d.y <= H).astype(float), np.where(d.cens >= H, 0.0, np.nan))
    e['p'] = model.predict_proba(e[FEAT])[:, 1]; e['strict'] = band_hi(d.eta_ours.values) <= H
    return e[e.lab.notna()]
tr, te = df[df.test == 0], df[df.test == 1]
print('1. "On track" (said it falls in time) - right / share of real falls it called')
for H in [24, 48, 72]:
    a, b = at(tr, H), at(te, H)
    prec_tr = a[a.strict].lab.mean()
    taus = np.linspace(.5, .99, 50); tau = next((t for t in taus if a[a.p >= t].lab.mean() >= prec_tr), .99)
    for name, d in [('2026 all', b), ('2026 order planets', b[b.mo_f == 1])]:
        s, m = d[d.strict], d[d.p >= tau]
        print(f'   H {H}h {name:20s} engine rule: right {s.lab.mean()*100:5.1f}% of {len(s):4d}, calls {s.lab.sum()/max(1,d.lab.sum())*100:5.1f}% of falls | model P>={tau:.2f}: right {m.lab.mean()*100:5.1f}% of {len(m):4d}, calls {m.lab.sum()/max(1,d.lab.sum())*100:5.1f}% of falls')
print('2. Brier score, engine (calibrated on 2024-25) vs model, 2026, bootstrap over planets (2000 draws)')
from sklearn.linear_model import LogisticRegression
rng = np.random.default_rng(1)
for H in [24, 48, 72]:
    a, b = at(tr, H), at(te, H)
    lr = LogisticRegression().fit(a[['r_ours']], a.lab); b = b.assign(pe=lr.predict_proba(b[['r_ours']])[:, 1])
    b['de'] = (b.pe - b.lab) ** 2; b['dm'] = (b.p - b.lab) ** 2
    g = b.groupby('planet')[['de', 'dm']].agg(['sum', 'count'])
    planets = g.index.values; diffs = []
    for _ in range(2000):
        s = rng.choice(planets, len(planets)); x = g.loc[s]
        diffs.append(x[('de', 'sum')].sum() / x[('de', 'count')].sum() - x[('dm', 'sum')].sum() / x[('dm', 'count')].sum())
    lo, hi = np.percentile(diffs, [2.5, 97.5])
    print(f'   H {H}h: engine {b.de.mean():.3f}  model {b.dm.mean():.3f}  improvement {b.de.mean()-b.dm.mean():.3f}  95% interval [{lo:.3f}, {hi:.3f}]')
