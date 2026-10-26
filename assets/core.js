/* อัลกอริทึมทั้งหมดของเว็บ (ไม่มีส่วน UI) — ใช้ได้ทั้งในเบราว์เซอร์และ node (สำหรับทดสอบ)
 * กติกาเดียวกับชีทอาจารย์: ถ้ามีตัวเลือกเสมอกันให้ใช้ FIFO (ตัวที่เข้ามาก่อน) ตัดสิน */
(function (root) {
  "use strict";
  const OS = {};

  /* ---------------- page replacement ---------------- */
  // คืนค่า steps: แต่ละขั้นมีสถานะเฟรมหลังทำ, hit/fault, เพจที่ถูกเอาออก และข้อมูลประกอบคำอธิบาย
  OS.pageReplace = function (ref, nFrames, algo) {
    const frames = new Array(nFrames).fill(null);
    const loaded = {}, last = {}, cnt = {};
    const steps = [];
    let faults = 0;
    ref.forEach((p, i) => {
      const step = { i, page: p, hit: false, slot: -1, victim: null, info: null };
      const at = frames.indexOf(p);
      if (at >= 0) {
        step.hit = true; step.slot = at;
        last[p] = i; cnt[p] += 1;
      } else {
        faults++;
        let slot = frames.indexOf(null);
        if (slot < 0) {
          const live = frames.slice();
          const info = {};
          live.forEach(q => {
            info[q] = {
              loaded: loaded[q], last: last[q], count: cnt[q],
              next: (() => { const k = ref.indexOf(q, i + 1); return k < 0 ? Infinity : k; })()
            };
          });
          const byLoad = (a, b) => info[a].loaded - info[b].loaded;
          let order;
          if (algo === "FIFO") order = live.slice().sort(byLoad);
          else if (algo === "LRU") order = live.slice().sort((a, b) => info[a].last - info[b].last);
          else if (algo === "OPT") order = live.slice().sort((a, b) => (info[b].next - info[a].next) || byLoad(a, b));
          else if (algo === "LFU") order = live.slice().sort((a, b) => (info[a].count - info[b].count) || byLoad(a, b));
          else if (algo === "MFU") order = live.slice().sort((a, b) => (info[b].count - info[a].count) || byLoad(a, b));
          else throw new Error("unknown algo " + algo);
          const victim = order[0];
          slot = frames.indexOf(victim);
          step.victim = victim; step.info = info; step.order = order;
          // ตัวที่ค่าเท่ากับ victim (ต้องใช้ FIFO ตัดสิน)
          const key = q => algo === "FIFO" ? info[q].loaded : algo === "LRU" ? info[q].last :
            algo === "OPT" ? info[q].next : info[q].count;
          step.tied = live.filter(q => q !== victim && key(q) === key(victim));
        }
        frames[slot] = p; step.slot = slot;
        loaded[p] = i; last[p] = i; cnt[p] = 1;
      }
      step.frames = frames.slice();
      step.counts = Object.assign({}, cnt);
      steps.push(step);
    });
    return { steps, faults, hits: ref.length - faults, n: ref.length, rate: faults / ref.length };
  };

  OS.refFromAddresses = function (addrs, pageSize, collapse) {
    const pages = addrs.map(a => Math.floor(a / pageSize));
    if (!collapse) return pages;
    return pages.filter((p, i) => i === 0 || p !== pages[i - 1]);
  };

  /* ---------------- vectors ---------------- */
  const le = (a, b) => a.every((x, k) => x <= b[k]);
  const add = (a, b) => a.map((x, k) => x + b[k]);
  const sub = (a, b) => a.map((x, k) => x - b[k]);
  OS.vec = { le, add, sub };

  /* ---------------- Banker's / detection ---------------- */
  // ไล่ P1 → Pn แล้ววนรอบใหม่ (ไล่ต่อจากตัวถัดไป) เหมือนเฉลยในชีท
  function scan(need, alloc, work0, finish0) {
    const n = need.length;
    let work = work0.slice();
    const finish = finish0.slice();
    const steps = [], seq = [];
    let progress = true, pass = 0;
    while (progress && finish.some(f => !f)) {
      progress = false; pass++;
      for (let i = 0; i < n; i++) {
        if (finish[i]) continue;
        const ok = le(need[i], work);
        const st = { pass, i, need: need[i].slice(), work: work.slice(), ok };
        if (ok) {
          work = add(work, alloc[i]); finish[i] = true; seq.push(i); progress = true;
          st.workAfter = work.slice();
        }
        steps.push(st);
      }
    }
    return { steps, seq, finish, work, ok: finish.every(Boolean) };
  }

  OS.banker = {
    need: (max, alloc) => max.map((r, i) => sub(r, alloc[i])),
    total: (alloc, avail) => alloc.reduce((s, r) => add(s, r), avail.slice()),
    safety(alloc, max, avail) {
      const need = OS.banker.need(max, alloc);
      const r = scan(need, alloc, avail, alloc.map(() => false));
      return Object.assign(r, { need });
    },
    request(alloc, max, avail, i, req) {
      const need = OS.banker.need(max, alloc);
      const out = { need, i, req, leNeed: le(req, need[i]), leAvail: le(req, avail) };
      if (!out.leNeed) { out.verdict = "error"; return out; }
      if (!out.leAvail) { out.verdict = "wait"; return out; }
      const alloc2 = alloc.map(r => r.slice()); alloc2[i] = add(alloc2[i], req);
      const avail2 = sub(avail, req);
      out.alloc2 = alloc2; out.avail2 = avail2;
      out.safety = OS.banker.safety(alloc2, max, avail2);
      out.verdict = out.safety.ok ? "grant" : "unsafe";
      return out;
    }
  };

  // deadlock detection (หลาย instance): Finish_i เริ่มเป็น true ถ้า Allocation_i = 0
  OS.detect = function (alloc, request, avail) {
    const fin0 = alloc.map(r => r.every(x => x === 0));
    const r = scan(request, alloc, avail, fin0);
    r.deadlocked = r.finish.map((f, i) => f ? -1 : i).filter(i => i >= 0);
    return r;
  };

  /* ---------------- resource allocation graph ---------------- */
  // node: "P0".."Pn-1", "R0".."Rm-1"; P→R = request, R→P = allocation
  OS.rag = {
    edges(alloc, request) {
      const e = [];
      alloc.forEach((row, i) => row.forEach((x, j) => { if (x > 0) e.push({ from: "R" + j, to: "P" + i, kind: "alloc", count: x }); }));
      request.forEach((row, i) => row.forEach((x, j) => { if (x > 0) e.push({ from: "P" + i, to: "R" + j, kind: "req", count: x }); }));
      return e;
    },
    cycles(alloc, request) {
      const edges = OS.rag.edges(alloc, request);
      const adj = {};
      edges.forEach(e => { (adj[e.from] = adj[e.from] || []).push(e.to); });
      const nodes = Object.keys(adj).sort(nodeCmp);
      const found = [];
      nodes.forEach(start => {
        const stack = [start], seen = new Set([start]);
        (function dfs(u) {
          (adj[u] || []).forEach(v => {
            if (v === start) found.push(stack.concat([start]));
            else if (!seen.has(v) && nodeCmp(v, start) > 0) {
              seen.add(v); stack.push(v); dfs(v); stack.pop(); seen.delete(v);
            }
          });
        })(start);
      });
      return found;
    }
  };
  function nodeCmp(a, b) {
    // เรียง P ก่อน R แล้วตามเลข
    if (a[0] !== b[0]) return a[0] === "P" ? -1 : 1;
    return parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10);
  }

  /* ---------------- memory ---------------- */
  OS.paging = {
    translate(logical, pageSize, table) {
      const p = Math.floor(logical / pageSize), d = logical % pageSize;
      const f = table[p];
      const valid = f !== undefined && f !== null && !Number.isNaN(f);
      return { p, d, f, valid, physical: valid ? f * pageSize + d : null };
    },
    bits(pageSize) { return Math.log2(pageSize); }
  };

  OS.fit = function (holes, procs, how) {
    const h = holes.map((size, k) => ({ id: k, size, used: [] }));
    const res = procs.map(size => {
      const cand = h.filter(x => x.size >= size);
      if (!cand.length) return { size, hole: -1 };
      let pick = cand[0];
      if (how === "best") pick = cand.reduce((a, b) => b.size < a.size ? b : a);
      if (how === "worst") pick = cand.reduce((a, b) => b.size > a.size ? b : a);
      const before = pick.size;
      pick.size -= size; pick.used.push(size);
      return { size, hole: pick.id, before, after: pick.size };
    });
    return { placements: res, holes: h };
  };

  // ตัวอย่าง 3.1.ก: low memory + first-fit, job queue FCFS, RR quantum q
  OS.partitionRR = function (total, osSize, jobs, q) {
    let holes = [[osSize, total]];
    const alloc = {}, rem = {}, events = [], jobQ = jobs.slice(), ready = [];
    let t = 0;
    const snapshot = () => {
      const blocks = Object.keys(alloc).map(n => ({ name: n, start: alloc[n][0], end: alloc[n][1] }));
      return blocks.sort((a, b) => a.start - b.start);
    };
    function tryAlloc() {
      while (jobQ.length) {
        const j = jobQ[0];
        const k = holes.findIndex(h => h[1] - h[0] >= j.size);
        if (k < 0) return;
        const s = holes[k][0];
        alloc[j.name] = [s, s + j.size]; holes[k] = [s + j.size, holes[k][1]];
        rem[j.name] = j.burst; ready.push(j.name); jobQ.shift();
        events.push({ t, type: "alloc", name: j.name, start: s, end: s + j.size, map: snapshot(), holes: holesNow() });
      }
    }
    function holesNow() { return holes.filter(h => h[1] > h[0]).map(h => h.slice()); }
    tryAlloc();
    const runs = [];
    while (ready.length) {
      const p = ready.shift(); runs.push(p); rem[p] -= q; t += q;
      if (rem[p] <= 0) {
        const [s, e] = alloc[p]; delete alloc[p];
        holes.push([s, e]); holes.sort((a, b) => a[0] - b[0]);
        const merged = [];
        holes.forEach(h => {
          if (h[1] <= h[0]) return;
          if (merged.length && merged[merged.length - 1][1] === h[0]) merged[merged.length - 1][1] = h[1];
          else merged.push(h.slice());
        });
        holes = merged;
        events.push({ t, type: "terminate", name: p, start: s, end: e, map: snapshot(), holes: holesNow() });
        tryAlloc();
      } else ready.push(p);
    }
    return { events, runs };
  };

  /* ---------------- disk scheduling ---------------- */
  // dir: "down" = กำลังไปทาง track 0 (แบบชีท), "up" = ไปทาง track สูงสุด
  OS.disk = function (queue, head, maxTrack, dir, algo) {
    let path = [head];
    const lower = queue.filter(x => x <= head).sort((a, b) => b - a);   // ใกล้ → ไกล
    const upper = queue.filter(x => x > head).sort((a, b) => a - b);
    const jumps = []; // index ของช่วงที่เป็นการกระโดดกลับ (C-SCAN / C-LOOK)
    if (algo === "FCFS") path = path.concat(queue);
    else if (algo === "SSTF") {
      const pend = queue.slice(); let h = head;
      while (pend.length) {
        let k = 0;
        pend.forEach((x, idx) => { if (Math.abs(x - h) < Math.abs(pend[k] - h)) k = idx; });
        h = pend.splice(k, 1)[0]; path.push(h);
      }
    } else {
      const first = dir === "down" ? lower : upper;
      const second = dir === "down" ? upper : lower;           // ลำดับใกล้ → ไกลจาก head
      const edge = dir === "down" ? 0 : maxTrack;
      const other = dir === "down" ? maxTrack : 0;
      path = path.concat(first);
      if (algo === "SCAN") {
        // วิ่งไปจนสุดปลายดิสก์ก่อนเสมอ แล้วค่อยกลับ
        if (path[path.length - 1] !== edge) path.push(edge);
        path = path.concat(second);
      } else if (algo === "LOOK") {
        path = path.concat(second);
      } else if (algo === "C-SCAN") {
        if (path[path.length - 1] !== edge) path.push(edge);
        if (second.length) {
          jumps.push(path.length - 1); path.push(other);
          path = path.concat(second.slice().reverse());
        }
      } else if (algo === "C-LOOK") {
        if (second.length) {
          jumps.push(path.length - 1);
          path = path.concat(second.slice().reverse());
        }
      } else throw new Error("unknown disk algo " + algo);
    }
    const terms = [];
    for (let k = 1; k < path.length; k++) terms.push({ from: path[k - 1], to: path[k], dist: Math.abs(path[k] - path[k - 1]), jump: jumps.includes(k - 1) });
    return { path, terms, total: terms.reduce((s, x) => s + x.dist, 0) };
  };

  /* ---------------- file / protection ---------------- */
  OS.bitVector = function (nBlocks, free, freeBit) {
    const fb = freeBit === undefined ? 0 : freeBit;
    const set = new Set(free);
    return Array.from({ length: nBlocks }, (_, b) => set.has(b) ? fb : 1 - fb);
  };

  OS.perm = {
    toOctal(bits) { // bits: [[r,w,x] x3]
      return bits.map(g => (g[0] ? 4 : 0) + (g[1] ? 2 : 0) + (g[2] ? 1 : 0)).join("");
    },
    toString(bits) { return bits.map(g => (g[0] ? "r" : "-") + (g[1] ? "w" : "-") + (g[2] ? "x" : "-")).join(""); },
    fromOctal(oct) { return String(oct).split("").map(c => { const v = parseInt(c, 8); return [!!(v & 4), !!(v & 2), !!(v & 1)]; }); },
    fromString(s) { const g = []; for (let k = 0; k < 9; k += 3) g.push([s[k] === "r", s[k + 1] === "w", s[k + 2] === "x"]); return g; }
  };

  OS.fsm = {
    run(trans, start, input) { // trans: [{from, sym, to}]
      const path = [start]; let s = start;
      for (const c of input) {
        const t = trans.find(x => x.from === s && x.sym === c);
        if (!t) { path.push(null); break; }
        s = t.to; path.push(s);
      }
      return path;
    },
    violations(trans, secure) { return trans.filter(t => secure.includes(t.from) && !secure.includes(t.to)); }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = OS;
  else root.OS = OS;
})(this);
