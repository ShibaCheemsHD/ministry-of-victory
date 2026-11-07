import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pickle, numpy as np, warnings; warnings.filterwarnings('ignore')
from common import prep, at
df = prep('feat.csv'); model, FEAT = pickle.load(open('model2_lean.pkl', 'rb'))
tr, te = df[df.test == 0], df[df.test == 1]
rules = {'engine strict (today)': lambda d: d.strict, 'model P>=0.80': lambda d: d.p >= .80, 'model P>=0.90': lambda d: d.p >= .90,
 'strict OR P>=0.90': lambda d: d.strict | (d.p >= .90), 'strict AND P>=0.50': lambda d: d.strict & (d.p >= .50), 'strict OR P>=0.80': lambda d: d.strict | (d.p >= .80)}
for per, D in [('2024-25', tr), ('2026', te)]:
  for sub in ['all', 'order']:
    print(per, sub, '(right / share of real falls called, at 24 | 48 | 72 h)')
    for name, f in rules.items():
      R = []
      for H in [24, 48, 72]:
        d = at(D, H, model, FEAT); d = d[d.mo_f == 1] if sub == 'order' else d
        s = f(d); R.append((d[s].lab.mean() if s.sum() else np.nan, d[s].lab.sum() / max(1, d.lab.sum())))
      print(f"   {name:24s} " + ' | '.join(f"{p*100:4.0f}% / {r*100:3.0f}%" for p, r in R))
