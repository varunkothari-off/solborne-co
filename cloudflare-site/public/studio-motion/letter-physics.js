export function step(s, dt) {
  dt = Math.min(.025, Math.max(0, dt));
  for (const [p,v] of [['x','vx'],['y','vy']]) {
    s[v] += (-10 * s[p] - 5.8 * s[v]) * dt;
    s[p] += s[v] * dt;
    if (Math.abs(s[p]) < .08 && Math.abs(s[v]) < .3) s[p] = s[v] = 0;
  }
  return s;
}
