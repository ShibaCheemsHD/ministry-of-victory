"""One probability for any deadline: P(the planet falls within H hours), H a feature, monotone in H.
Gradient boosting on stacked (row, H) pairs; fit on 2024-25, judged on 2026. Its median (H where P = 0.5)
is also a fall time, compared with the engine's.
Usage: python3 -I model2.py feat.csv [features: full|lean]
"""
import sys, json, numpy as np, pandas as pd, warnings
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import GroupKFold
warnings.filterwarnings('ignore')
df = pd.read_csv(sys.argv[1]); MODE = sys.argv[2] if len(sys.argv) > 2 else 'full'
L = lambda x: np.log(np.clip(x, 0.05, 1e4))
df['eta_line1'] = df.eta_line1.fillna(1e4); df['eta_line6'] = df.eta_line6.fillna(1e4)
df['l_left'] = L(df.left); df['l_share'] = L(df.share)
df['d_share6'] = (df.share - df.share6).fillna(0); df['d_share24'] = (df.share - df.share24).fillna(0)
df['l_regen'] = np.log1p(df.regen * 100)
df['mo_f'] = df.mo.fillna(-1)
df['hs'] = np.sin(df.hour / 24 * 2 * np.pi); df['hc'] = np.cos(df.hour / 24 * 2 * np.pi)
HS = [6, 12, 18, 24, 36, 48, 72, 96, 120]
def stack(d):
    out = []
    for H in HS:
        e = d.copy(); e['H'] = H; e['lH'] = np.log(H)
        e['r_ours'] = L(d.eta_ours) - np.log(H); e['r_line1'] = L(d.eta_line1) - np.log(H); e['r_line6'] = L(d.eta_line6) - np.log(H)
        e['r_mo'] = np.where(d.mo_left.notna(), L(d.mo_left) - np.log(H), 9)
        e['lab'] = np.where(d.y.notna(), (d.y <= H).astype(float), np.where(d.cens >= H, 0.0, np.nan))
        out.append(e)
    return pd.concat(out, ignore_index=True)
FULL = ['lH', 'r_ours', 'r_line1', 'r_line6', 'l_left', 'l_share', 'd_share6', 'd_share24', 'l_regen', 'pace1', 'pace3', 'pace6', 'pace12', 'pace24', 'mo_f', 'r_mo', 'dss', 'hs', 'hc', 'dow', 'age']
LEAN = ['lH', 'r_ours', 'r_line1', 'r_line6', 'l_left', 'l_share', 'd_share6', 'd_share24', 'l_regen', 'pace1', 'pace6', 'pace24', 'mo_f', 'dss']
FEAT = FULL if MODE == 'full' else LEAN
tr, te = stack(df[df.test == 0]), stack(df[df.test == 1])
tr, te = tr[tr.lab.notna()], te[te.lab.notna()]
# monotone: more time can only make a fall more likely; a later forecast fall (vs H), less likely
mono = [1 if f == 'lH' else -1 if f in ('r_ours', 'r_line1', 'r_line6') else 0 for f in FEAT]
best = None
for depth in [3, 4, 5]:
    for it in [200, 400]:
        c = dict(max_depth=depth, learning_rate=0.05, max_iter=it, l2_regularization=1.0, min_samples_leaf=60, monotonic_cst=mono)
        ll = []
        for a, b in GroupKFold(5).split(tr, groups=tr.planet):
            g = HistGradientBoostingClassifier(**c).fit(tr[FEAT].iloc[a], tr.lab.iloc[a]); p = np.clip(g.predict_proba(tr[FEAT].iloc[b])[:, 1], 1e-4, 1 - 1e-4)
            y = tr.lab.iloc[b].values; ll.append(-(y * np.log(p) + (1 - y) * np.log(1 - p)).mean())
        if best is None or np.mean(ll) < best[0]: best = (np.mean(ll), c)
model = HistGradientBoostingClassifier(**best[1]).fit(tr[FEAT], tr.lab)
te['p'] = model.predict_proba(te[FEAT])[:, 1]
# the engine as it is today, verdict = eta <= H
te['hard'] = (te.eta_ours <= te.H).astype(float)
def sc(d, col):
    p = np.clip(d[col].values, 1e-4, 1 - 1e-4); y = d.lab.values; pred = p >= .5
    return (pred == y).mean() * 100, (pred & (y == 0)).mean() * 100, ((p - y) ** 2).mean()
print(f'features {MODE} ({len(FEAT)}), best {best[1]["max_depth"]}/{best[1]["max_iter"]}, CV logloss {best[0]:.3f}')
for name, d in [('all 2026', te), ('2026, order planets', te[te.mo_f == 1]), ('2026, share >= 10%', te[te.share >= .1])]:
    print(f'  {name} ({d.planet.nunique()} planets, {len(d)} pairs)')
    for H in [12, 24, 48, 72, 96]:
        x = d[d.H == H]
        if len(x) < 20: continue
        a = sc(x, 'hard'); b = sc(x, 'p')
        print(f'    H {H:3d}h n={len(x):4d}  engine today: right {a[0]:5.1f}% false wins {a[1]:4.1f}% Brier {a[2]:.3f}  |  model: right {b[0]:5.1f}% false wins {b[1]:4.1f}% Brier {b[2]:.3f}')
# calibration: predicted vs observed, 2026
te['bin'] = pd.cut(te.p, [0, .1, .3, .5, .7, .9, 1.0], include_lowest=True)
print('  calibration 2026 (said -> happened):', ', '.join(f'{iv}: {g.lab.mean()*100:.0f}% (n={len(g)})' for iv, g in te.groupby('bin', observed=True)))
# the model's own fall time: smallest H on a fine grid where P >= 0.5
rows = df[df.test == 1].copy(); fine = np.exp(np.linspace(np.log(1), np.log(300), 60))
P = []
for H in fine:
    e = rows.copy(); e['H'] = H; e['lH'] = np.log(H)
    e['r_ours'] = L(rows.eta_ours) - np.log(H); e['r_line1'] = L(rows.eta_line1) - np.log(H); e['r_line6'] = L(rows.eta_line6) - np.log(H)
    e['r_mo'] = np.where(rows.mo_left.notna(), L(rows.mo_left) - np.log(H), 9)
    P.append(model.predict_proba(e[FEAT])[:, 1])
P = np.array(P).T
med = np.array([fine[np.argmax(p >= .5)] if (p >= .5).any() else 1e4 for p in P])
f = rows.y.notna() & (rows.y <= 96)
for name, eta in [('engine today', rows.eta_ours.values), ('model median', med), ('mix: model median if engine is past it', np.maximum(rows.eta_ours.values, med) )]:
    e = np.abs(np.log(np.clip(eta, .05, 1e4) / rows.y))[f]
    print(f'  fall time, 2026 falls within 4 days (n={f.sum()}): {name:40s} within 25% {np.mean(e <= np.log(1.25))*100:5.1f}%  median miss {np.median(np.abs(np.clip(eta,0,1e4)-rows.y)[f]):.1f} h')
import pickle; pickle.dump((model, FEAT), open(f'model2_{MODE}.pkl', 'wb'))
