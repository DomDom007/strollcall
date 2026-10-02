// Strollcall: a standing weekly walk with a friend, both on the phone, plus a streak that keeps you both going.
import { useState } from "react";
import { downloadIcs } from "./lib/ics";
import { openLater, shareLink, waLink } from "./lib/share";
import { uid, useStored } from "./lib/store";
import { useShared } from "./lib/useShared";
import { addDays, prettyDate, todayISO } from "./lib/time";
import { Section, Stat, Stats } from "./ui/kit";

const T = "strollcall";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const RR = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
type Slot = { id: string; buddy: string; phone: string; day: number; time: string; minutes: number; from: string };
type Walk = { id: string; date: string; minutes: number; km: number; with: string };

function nextDate(day: number, time: string) {
  const d = new Date(); const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  while (d.getDay() !== day || d < new Date()) d.setDate(d.getDate() + 1);
  return d;
}
const icsFor = (s: Slot, me: string) => ({ title: `Walk and talk with ${s.buddy || me}`, start: nextDate(s.day, s.time), end: new Date(nextDate(s.day, s.time).getTime() + s.minutes * 60000), rrule: `FREQ=WEEKLY;BYDAY=${RR[s.day]}`, alarmMinutes: 10, description: "Put your shoes on, call each other, and walk." });

export default function Strollcall() {
  const shared = useShared<Slot & { me: string }>();
  const [me, setMe] = useStored(T, "me", "Leila");
  const [slots, setSlots] = useStored<Slot[]>(T, "slots", [{ id: "s1", buddy: "Amel", phone: "", day: 2, time: "18:30", minutes: 30, from: todayISO() }, { id: "s2", buddy: "Dad", phone: "", day: 6, time: "09:00", minutes: 45, from: todayISO() }]);
  const [walks, setWalks] = useStored<Walk[]>(T, "walks", [{ id: "w1", date: addDays(todayISO(), -1), minutes: 30, km: 2.6, with: "Amel" }, { id: "w2", date: addDays(todayISO(), -5), minutes: 45, km: 3.9, with: "Dad" }, { id: "w3", date: addDays(todayISO(), -8), minutes: 30, km: 2.4, with: "Amel" }, { id: "w4", date: addDays(todayISO(), -12), minutes: 40, km: 3.3, with: "Dad" }]);
  const [goal, setGoal] = useStored(T, "goal", 2);
  const [d, setD] = useState({ buddy: "", phone: "", day: 3, time: "18:00", minutes: 30 });
  const [log, setLog] = useState({ minutes: "30", km: "", with: "" });

  if (shared.loading) return <p className="empty-note">Opening invitation…</p>;
  if (shared.data) {
    const s = shared.data;
    return (
      <section className="panel stack" style={{ gap: 12, maxWidth: 560 }}>
        <p className="eyebrow">Invitation from {s.me}</p>
        <h2 style={{ fontSize: 34 }}>Walk and talk every {DAYS[s.day]} at {s.time}</h2>
        <p>You both head out for a walk at the same time and call each other. {s.minutes} minutes, wherever you are.</p>
        <button className="btn primary" style={{ alignSelf: "flex-start" }} onClick={() => downloadIcs("walk-and-talk.ics", [{ ...icsFor({ ...s, buddy: s.me }, s.me) }], "Walk and talk")}>Add it to my calendar</button>
        <a className="btn" style={{ alignSelf: "flex-start" }} href="/t/strollcall">Track my own walks</a>
      </section>
    );
  }

  // Weeks in a row where the goal was met, counting back from this week.
  const weekStart = (iso: string) => { const x = new Date(iso + "T12:00:00Z"); const k = (x.getUTCDay() + 6) % 7; return addDays(iso, -k); };
  const thisWeek = weekStart(todayISO());
  let streak = 0;
  for (let w = 0; w < 104; w++) { const ws = addDays(thisWeek, -7 * w), n = walks.filter(x => weekStart(x.date) === ws).length; if (n >= goal) streak++; else if (w > 0) break; }
  const weekWalks = walks.filter(x => weekStart(x.date) === thisWeek);
  const month = walks.filter(x => x.date >= addDays(todayISO(), -30));
  const weeks = Array.from({ length: 12 }, (_, i) => { const ws = addDays(thisWeek, -7 * (11 - i)); return { ws, n: walks.filter(x => weekStart(x.date) === ws).length }; });

  return (
    <div className="stack">
      <Section title="Your walking weeks">
        <Stats><Stat value={streak} label={`Weeks in a row with ${goal}+ walks`} tone={streak ? "good" : undefined} /><Stat value={`${weekWalks.length}/${goal}`} label="This week" /><Stat value={`${month.reduce((a, x) => a + x.km, 0).toFixed(1)} km`} label="Last 30 days" /><Stat value={`${Math.round(month.reduce((a, x) => a + x.minutes, 0) / 60 * 10) / 10} h`} label="Time outside" /></Stats>
        <div className="sc-weeks">{weeks.map(w => <div key={w.ws} title={`Week of ${w.ws}: ${w.n} walks`} className="sc-week"><span style={{ height: `${Math.min(100, (w.n / Math.max(goal, 1)) * 100)}%`, background: w.n >= goal ? "var(--good)" : "var(--warn)" }} /></div>)}</div>
        <p className="note">Last 12 weeks. Green means the goal was met.</p>
      </Section>
      <div className="grid2">
        <Section title="Standing walks">
          <div className="stack" style={{ gap: 8 }}>
            {slots.map(s => (
              <div key={s.id} className="sc-slot">
                <div style={{ flex: 1 }}><strong>{s.buddy}</strong><p className="note">Every {DAYS[s.day]} at {s.time}, {s.minutes} min · next {prettyDate(nextDate(s.day, s.time).toISOString().slice(0, 10))}</p></div>
                <button className="btn small" onClick={() => openLater(async () => waLink(`Want to walk and talk every ${DAYS[s.day]} at ${s.time}? We each walk wherever we are and call each other. Add it to your calendar here: ${await shareLink(T, { ...s, me }, "m=invite")}`, s.phone))}>Invite</button>
                <button className="btn small" onClick={() => downloadIcs(`walk-${s.buddy}.ics`, [icsFor(s, me)], "Walk and talk")}>Calendar</button>
                <button className="btn ghost small danger" onClick={() => setSlots(slots.filter(x => x.id !== s.id))}>×</button>
              </div>
            ))}
          </div>
          <form className="row" style={{ marginTop: 12, alignItems: "flex-end" }} onSubmit={e => { e.preventDefault(); if (!d.buddy.trim()) return; setSlots([...slots, { id: uid(), ...d, buddy: d.buddy.trim(), from: todayISO() }]); setD({ ...d, buddy: "", phone: "" }); }}>
            <label className="field"><span>Walk with</span><input id="sc-b" className="input" value={d.buddy} onChange={e => setD({ ...d, buddy: e.target.value })} /></label>
            <label className="field"><span>Their WhatsApp</span><input id="sc-p" className="input" value={d.phone} onChange={e => setD({ ...d, phone: e.target.value })} /></label>
            <label className="field"><span>Day</span><select id="sc-d" className="input" value={d.day} onChange={e => setD({ ...d, day: +e.target.value })}>{DAYS.map((x, i) => <option key={x} value={i}>{x}</option>)}</select></label>
            <label className="field"><span>Time</span><input id="sc-t" type="time" className="input" value={d.time} onChange={e => setD({ ...d, time: e.target.value })} /></label>
            <label className="field" style={{ flex: "0 0 80px" }}><span>Minutes</span><input id="sc-m" className="input num" value={d.minutes} onChange={e => setD({ ...d, minutes: parseInt(e.target.value) || 30 })} /></label>
            <button className="btn primary" type="submit">Add</button>
          </form>
        </Section>
        <Section title="Log a walk">
          <form className="row" style={{ alignItems: "flex-end" }} onSubmit={e => { e.preventDefault(); setWalks([{ id: uid(), date: todayISO(), minutes: parseInt(log.minutes) || 0, km: parseFloat(log.km) || 0, with: log.with }, ...walks]); setLog({ ...log, km: "" }); }}>
            <label className="field"><span>Minutes</span><input id="sc-lm" className="input num" value={log.minutes} onChange={e => setLog({ ...log, minutes: e.target.value })} /></label>
            <label className="field"><span>Km (optional)</span><input id="sc-lk" className="input num" value={log.km} onChange={e => setLog({ ...log, km: e.target.value })} /></label>
            <label className="field"><span>With</span><select id="sc-lw" className="input" value={log.with} onChange={e => setLog({ ...log, with: e.target.value })}><option value="">On my own</option>{slots.map(s => <option key={s.id}>{s.buddy}</option>)}</select></label>
            <button className="btn primary" type="submit">I walked today</button>
          </form>
          <div className="row" style={{ marginTop: 12, alignItems: "flex-end" }}>
            <label className="field" style={{ flex: "0 0 160px" }}><span>Weekly goal</span><select id="sc-goal" className="input" value={goal} onChange={e => setGoal(+e.target.value)}>{[1, 2, 3, 4, 5, 7].map(n => <option key={n} value={n}>{n} walks</option>)}</select></label>
            <label className="field" style={{ flex: "0 0 160px" }}><span>Your name</span><input id="sc-me" className="input" value={me} onChange={e => setMe(e.target.value)} /></label>
          </div>
          <div className="stack" style={{ gap: 4, marginTop: 12 }}>{walks.slice(0, 8).map(w => <div key={w.id} className="row note" style={{ justifyContent: "space-between" }}><span>{prettyDate(w.date)} · {w.minutes} min{w.km ? ` · ${w.km} km` : ""}{w.with ? ` · with ${w.with}` : ""}</span><button className="btn ghost small danger" onClick={() => setWalks(walks.filter(x => x.id !== w.id))}>×</button></div>)}</div>
        </Section>
      </div>
      <style>{`.sc-weeks{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;height:60px;margin:16px 0 6px}.sc-week{display:flex;align-items:flex-end;background:var(--sunk);border-radius:4px;overflow:hidden}.sc-week span{width:100%;min-height:3px}
      .sc-slot{display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}`}</style>
    </div>
  );
}
