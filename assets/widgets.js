/* เครื่องมือลองเอง (interactive) — ใส่ในหน้าด้วย <div data-widget="ชื่อ" data-...></div> */
(function () {
  "use strict";
  const W = {};
  window.Widgets = W;
  const el = (...a) => UI.el(...a);
  const nums = s => UI.nums(s);
  const vec = v => "(" + v.join(", ") + ")";
  const svgNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, ...kids) {
    const e = document.createElementNS(svgNS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    kids.flat().forEach(c => e.append(c.nodeType ? c : document.createTextNode(String(c))));
    return e;
  }
  function frame(host, title, extra) {
    host.classList.add("widget");
    host.innerHTML = "";
    const body = el("div", { class: "wb" });
    host.append(el("div", { class: "wh" }, el("span", null, "🕹 " + title), extra || ""), body);
    return body;
  }
  function seg(options, value, onChange) {
    const s = el("div", { class: "seg" });
    options.forEach(([v, label]) => {
      const b = el("button", { class: v === value ? "on" : null }, label);
      b.addEventListener("click", () => { s.querySelectorAll("button").forEach(x => x.classList.remove("on")); b.classList.add("on"); onChange(v); });
      s.append(b);
    });
    return s;
  }
  function presetSelect(presets, onPick) {
    const s = el("select", null, el("option", { value: "" }, "เลือกโจทย์ตัวอย่าง…"), presets.map((p, k) => el("option", { value: k }, p.label)));
    s.addEventListener("change", () => { if (s.value !== "") onPick(presets[+s.value]); });
    return s;
  }
  const ALGO_NAME = { FIFO: "FIFO", OPT: "OPT (Optimal)", LRU: "LRU", LFU: "LFU", MFU: "MFU" };

  /* =====================================================================
     1) Page replacement — ดูทีละขั้น / ฝึกทายเพจที่ต้องเอาออก
     ===================================================================== */
  const PR_PRESETS = [
    { label: "การบ้าน (20 ตัว)", ref: "2 3 2 1 5 2 4 5 3 2 5 2 1 4 3 5 2 4 1 3", frames: 3 },
    { label: "ชีท 3.2.2 (7 0 1 2 …)", ref: "7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1", frames: 3 },
    { label: "ตัวอย่าง 3.2.ก (12 ตัว)", ref: "2 3 2 1 5 2 4 5 3 2 5 2", frames: 3 },
    { label: "Belady — 3 เฟรม", ref: "1 2 3 4 1 2 5 1 2 3 4 5", frames: 3, algo: "FIFO" },
    { label: "Belady — 4 เฟรม", ref: "1 2 3 4 1 2 5 1 2 3 4 5", frames: 4, algo: "FIFO" },
  ];
  W.pr = function (host) {
    const d = host.dataset;
    const st = { ref: nums(d.ref || PR_PRESETS[0].ref), n: +(d.frames || 3), algo: d.algo || "FIFO", mode: d.mode || "step", k: -1, res: null, wrong: 0 };
    const body = frame(host, "จำลอง Page Replacement", presetSelect(PR_PRESETS, p => {
      refIn.value = p.ref; nIn.value = p.frames; if (p.algo) setAlgo(p.algo); rebuild();
    }));
    const refIn = el("input", { type: "text", class: "wide", value: st.ref.join(" ") });
    const nIn = el("input", { type: "number", min: 1, max: 8, value: st.n });
    let algoSeg;
    const setAlgo = a => { st.algo = a; algoSeg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.textContent === a)); };
    algoSeg = seg(Object.keys(ALGO_NAME).map(a => [a, a]), st.algo, a => { st.algo = a; rebuild(); });
    const modeSeg = seg([["step", "ดูทีละขั้น"], ["practice", "ฝึกเอง: ทายเพจที่ต้องออก"]], st.mode, m => { st.mode = m; rebuild(); });
    const bReset = el("button", { class: "b" }, "⏮ เริ่มใหม่");
    const bPrev = el("button", { class: "b" }, "◀ ย้อน");
    const bNext = el("button", { class: "b pri" }, "ถัดไป ▶");
    const bAll = el("button", { class: "b" }, "แสดงทั้งหมด");
    const bCmp = el("button", { class: "b" }, "เทียบทุกอัลกอริทึม");
    const tbl = el("div", { class: "tblwrap" });
    const exp = el("div", { class: "explain" });
    const pick = el("div", { class: "row" });
    const sum = el("div", { class: "row muted" });
    const cmp = el("div");
    body.append(
      el("div", { class: "row" }, el("label", { class: "f" }, "Reference string", refIn), el("label", { class: "f" }, "จำนวนเฟรม", nIn)),
      el("div", { class: "row" }, algoSeg, modeSeg),
      el("div", { class: "row" }, bReset, bPrev, bNext, bAll, bCmp),
      tbl, pick, exp, sum, cmp,
      el("div", { class: "legend" }, el("span", null, el("i", { style: "background:var(--hl)" }), "เพจที่เพิ่งใส่"),
        el("span", null, el("i", { style: "background:var(--good-soft)" }), "hit"), el("span", null, "F = page fault"))
    );
    refIn.addEventListener("change", rebuild); nIn.addEventListener("change", rebuild);
    bReset.addEventListener("click", () => { st.k = -1; st.wrong = 0; draw(); });
    bPrev.addEventListener("click", () => { if (st.k >= 0) st.k--; draw(); });
    bNext.addEventListener("click", next);
    bAll.addEventListener("click", () => { st.k = st.res.steps.length - 1; draw(); });
    bCmp.addEventListener("click", () => {
      const rows = Object.keys(ALGO_NAME).map(a => { const r = OS.pageReplace(st.ref, st.n, a); return el("tr", null, el("td", null, a), el("td", null, r.faults), el("td", null, `${r.faults}/${r.n} = ${(100 * r.rate).toFixed(1)}%`)); });
      cmp.innerHTML = "";
      cmp.append(el("table", { class: "t" }, el("tr", null, el("th", null, "Algorithm"), el("th", null, "page fault"), el("th", null, "page fault rate")), rows),
        el("div", { class: "muted" }, "OPT ต้องน้อยที่สุดเสมอ ถ้าคำตอบของเราน้อยกว่า OPT แปลว่าทำผิดแน่นอน"));
    });
    function rebuild() {
      st.ref = nums(refIn.value); st.n = Math.max(1, Math.min(8, +nIn.value || 3));
      st.res = OS.pageReplace(st.ref, st.n, st.algo); st.k = -1; st.wrong = 0; cmp.innerHTML = ""; draw();
    }
    function next() {
      if (st.k >= st.res.steps.length - 1) return;
      const s = st.res.steps[st.k + 1];
      if (st.mode === "practice" && s.victim !== null && !st.awaiting) { st.awaiting = true; draw(); return; }
      if (st.awaiting) return;
      st.k++; draw();
    }
    function explainStep(s) {
      const pos = `ตำแหน่งที่ ${s.i + 1}`;
      if (s.hit) {
        let extra = "";
        if (st.algo === "LRU") extra = ` → อัปเดต "ใช้ล่าสุด" ของเพจ ${s.page} เป็นตำแหน่งที่ ${s.i + 1}`;
        if (st.algo === "LFU" || st.algo === "MFU") extra = ` → นับเพจ ${s.page} เพิ่มเป็น ${s.counts[s.page]} ครั้ง`;
        return `<span class="big">${pos}: อ้างเพจ ${s.page} → อยู่ในเฟรม F${s.slot + 1} แล้ว = <span class="ok">hit</span> (ไม่เกิด page fault)</span>${extra}`;
      }
      if (s.victim === null) return `<span class="big">${pos}: อ้างเพจ ${s.page} → ไม่อยู่ในเฟรม = <span class="no">page fault</span></span> แต่ยังมีเฟรมว่าง → ใส่ลง F${s.slot + 1} ได้เลย (เฟรมว่างตอนเริ่มก็นับเป็น fault)`;
      return `<span class="big">${pos}: อ้างเพจ ${s.page} → ไม่อยู่ในเฟรม = <span class="no">page fault</span></span> และเฟรมเต็ม ต้องเลือกเพจออก<br>` + reason(s) + `<br>→ เอาเพจ <b>${s.victim}</b> ออก แล้วใส่เพจ ${s.page} แทนที่ F${s.slot + 1}`;
    }
    function reason(s) {
      const inf = s.info, live = s.order.slice().sort((a, b) => inf[a].loaded - inf[b].loaded);
      const tie = s.tied && s.tied.length ? ` (เสมอกับ ${s.tied.join(", ")} → ใช้ FIFO: เพจ ${s.victim} เข้ามาก่อน)` : "";
      if (st.algo === "FIFO") return "FIFO ดูว่าใครเข้ามาก่อน: " + live.map(q => `เพจ ${q} เข้ามาตำแหน่งที่ ${inf[q].loaded + 1}`).join(", ") + ` → เข้ามาก่อนสุดคือ <b>${s.victim}</b>`;
      if (st.algo === "LRU") return "LRU ดูอดีตว่าใครไม่ได้ใช้นานที่สุด: " + live.map(q => `เพจ ${q} ใช้ล่าสุดตำแหน่งที่ ${inf[q].last + 1}`).join(", ") + ` → นานสุดคือ <b>${s.victim}</b>`;
      if (st.algo === "OPT") return "OPT มองไปข้างหน้า: " + live.map(q => inf[q].next === Infinity ? `เพจ ${q} <b>ไม่ถูกใช้อีกเลย</b>` : `เพจ ${q} จะใช้อีกที่ตำแหน่ง ${inf[q].next + 1}`).join(", ") + ` → ไกลที่สุดคือ <b>${s.victim}</b>` + tie;
      const what = st.algo === "LFU" ? "น้อยที่สุด" : "มากที่สุด";
      return `${st.algo} นับจำนวนครั้งที่ถูกใช้ (นับใหม่ทุกครั้งที่เข้ามา): ` + live.map(q => `เพจ ${q} = ${inf[q].count} ครั้ง`).join(", ") + ` → ${what}คือ <b>${s.victim}</b>` + tie;
    }
    function draw() {
      const steps = st.res.steps, k = st.k;
      const t = el("table", { class: "t pr" });
      t.append(el("tr", null, el("th", null, "ref"), steps.map((s, i) => el("th", { class: i === k + (st.awaiting ? 1 : 0) ? "cur" : null }, s.page))));
      for (let r = 0; r < st.n; r++) {
        t.append(el("tr", null, el("th", null, "F" + (r + 1)), steps.map((s, i) => {
          const v = s.frames[r];
          const show = i <= k;
          const cls = !show ? "future" : (s.slot === r && !s.hit ? "new" : (s.slot === r && s.hit ? "hitc" : null));
          return el("td", { class: cls }, v === null ? "-" : v);
        })));
      }
      t.append(el("tr", null, el("th", null, ""), steps.map((s, i) => el("td", { class: i <= k ? (s.hit ? "hit" : "fault") : "future" }, i <= k ? (s.hit ? "" : "F") : "."))));
      tbl.innerHTML = ""; tbl.append(t);
      pick.innerHTML = "";
      if (st.awaiting) {
        const s = steps[k + 1];
        const prev = k >= 0 ? steps[k].frames : [];
        exp.innerHTML = `<span class="big">ตำแหน่งที่ ${s.i + 1}: อ้างเพจ ${s.page} → page fault และเฟรมเต็ม</span><br>ใช้ ${ALGO_NAME[st.algo]} ต้องเอาเพจไหนออก? กดเลือกด้านล่าง`;
        pick.append(el("span", { class: "muted" }, "เอาออก:"), ...prev.map(q => {
          const b = el("button", { class: "b" }, "เพจ " + q);
          b.addEventListener("click", () => {
            if (q === s.victim) { st.awaiting = false; st.k++; draw(); exp.innerHTML = '<span class="ok">✓ ถูกต้อง</span> — ' + exp.innerHTML; }
            else { st.wrong++; b.disabled = true; exp.innerHTML = `<span class="no">✗ ยังไม่ใช่เพจ ${q}</span> ลองคิดใหม่<br><details><summary>ขอใบ้</summary>${reason(s)}</details>`; }
          });
          return b;
        }));
      } else if (k < 0) {
        exp.innerHTML = `กด <b>ถัดไป ▶</b> เพื่อดูทีละช่อง${st.mode === "practice" ? " — ทุกครั้งที่ต้องเอาเพจออก ระบบจะให้เราเลือกเอง" : ""} <span class="muted">(กติกาตามชีท: ถ้าเสมอกันใช้ FIFO ตัดสิน)</span>`;
      } else exp.innerHTML = explainStep(steps[k]);
      const done = steps.slice(0, k + 1), f = done.filter(s => !s.hit).length;
      sum.innerHTML = "";
      sum.append(`page fault ถึงตอนนี้: ${f} ครั้ง จาก ${done.length} การอ้าง`);
      if (k === steps.length - 1) sum.append(el("b", { class: "ok" }, ` ✔ จบ: ${ALGO_NAME[st.algo]} = ${st.res.faults} page faults, page fault rate = ${st.res.faults}/${st.res.n} = ${(100 * st.res.rate).toFixed(1)}%`), st.mode === "practice" ? ` (เลือกผิด ${st.wrong} ครั้ง)` : "");
      bPrev.disabled = k < 0 || st.awaiting; bNext.disabled = k >= steps.length - 1 || st.awaiting;
    }
    rebuild();
  };

  /* =====================================================================
     2) Belady chart — page fault เทียบจำนวนเฟรม
     ===================================================================== */
  W.belady = function (host) {
    const body = frame(host, "กราฟ page fault เมื่อเพิ่มจำนวนเฟรม (ดู Belady's anomaly)");
    const refIn = el("input", { type: "text", class: "wide", value: host.dataset.ref || "1 2 3 4 1 2 5 1 2 3 4 5" });
    const out = el("div"), note = el("div", { class: "explain" });
    body.append(el("div", { class: "row" }, el("label", { class: "f" }, "Reference string", refIn), el("button", { class: "b pri", onclick: draw }, "วาดกราฟ")), out, note);
    function draw() {
      const ref = nums(refIn.value), maxF = 7, algos = [["FIFO", "#c43d3d"], ["LRU", "#3157d5"], ["OPT", "#1a7f4b"]];
      const data = algos.map(([a]) => Array.from({ length: maxF }, (_, k) => OS.pageReplace(ref, k + 1, a).faults));
      const top = Math.max(...data.flat()), Wd = 520, Ht = 270, L = 40, B = 30;
      const X = k => L + k * (Wd - L - 20) / (maxF - 1), Y = v => Ht - B - v * (Ht - B - 30) / top;
      const g = svg("svg", { viewBox: `0 0 ${Wd} ${Ht}`, width: "100%", style: "max-width:560px" });
      for (let v = 0; v <= top; v += Math.ceil(top / 6)) g.append(svg("line", { x1: L, x2: Wd - 10, y1: Y(v), y2: Y(v), stroke: "#eee" }), svg("text", { x: L - 6, y: Y(v) + 4, "text-anchor": "end", "font-size": 11, fill: "#888" }, v));
      for (let k = 0; k < maxF; k++) g.append(svg("text", { x: X(k), y: Ht - 10, "text-anchor": "middle", "font-size": 12 }, k + 1));
      g.append(svg("text", { x: Wd / 2, y: Ht, "text-anchor": "middle", "font-size": 11, fill: "#666" }, "จำนวนเฟรม"));
      data.forEach((row, a) => {
        g.append(svg("polyline", { points: row.map((v, k) => X(k) + "," + Y(v)).join(" "), fill: "none", stroke: algos[a][1], "stroke-width": 2 }));
        row.forEach((v, k) => {
          const up = k > 0 && v > row[k - 1];
          g.append(svg("circle", { cx: X(k), cy: Y(v), r: up ? 6 : 3.5, fill: up ? "#ffcf4d" : algos[a][1], stroke: algos[a][1] }));
        });
      });
      algos.forEach(([a, c], i) => g.append(svg("text", { x: Wd - 230 + i * 70, y: 14, "font-size": 12, fill: c }, "● " + a)));
      out.innerHTML = ""; out.append(g);
      const an = [];
      data[0].forEach((v, k) => { if (k > 0 && v > data[0][k - 1]) an.push(`${k} → ${k + 1} เฟรม: ${data[0][k - 1]} → ${v}`); });
      note.innerHTML = an.length ? `<b class="no">เกิด Belady's anomaly กับ FIFO</b> (จุดสีเหลือง): ${an.join(", ")} คือเพิ่มเฟรมแล้ว fault กลับมากขึ้น<br>LRU กับ OPT จะไม่เกิด (เส้นไม่เคยเพิ่มขึ้น)` :
        "สตริงนี้ไม่เกิด Belady's anomaly (fault ลดลงหรือเท่าเดิมเมื่อเพิ่มเฟรม) ลองสตริง 1 2 3 4 1 2 5 1 2 3 4 5 ดู";
    }
    draw();
  };

  /* =====================================================================
     3) address → reference string
     ===================================================================== */
  W.addr2ref = function (host) {
    const body = frame(host, "แปลง address sequence → reference string");
    const aIn = el("input", { type: "text", class: "wide", value: host.dataset.addr || "0100 0432 0101 0612 0102 0103 0104 0101 0611 0102 0103" });
    const pIn = el("input", { type: "number", value: host.dataset.page || 100 });
    const out = el("div", { class: "explain" });
    body.append(el("div", { class: "row" }, el("label", { class: "f" }, "address", aIn), el("label", { class: "f" }, "byte/page", pIn), el("button", { class: "b pri", onclick: go }, "แปลง")), out);
    function go() {
      const a = aIn.value.split(/[\s,]+/).filter(Boolean).map(x => parseInt(x, 10)), ps = +pIn.value;
      const pages = OS.refFromAddresses(a, ps, false), ref = OS.refFromAddresses(a, ps, true);
      out.innerHTML = `<b>ขั้น 1</b> page = address div ${ps}: ` + a.map((x, k) => `${String(x).padStart(4, "0")}→${pages[k]}`).join(", ") +
        `<br><b>ขั้น 2</b> ยุบตัวที่ซ้ำติดกัน (อ้างเพจเดิมซ้ำทันทีไม่เกิด fault ใหม่): <b class="mono">${ref.join(", ")}</b>`;
    }
    go();
  };

  /* =====================================================================
     4) Banker's algorithm / deadlock detection (matrix editor + steps)
     ===================================================================== */
  const BANK_PRESETS = [
    { label: "ชีท หน้า 58–61 (P1–P5)", alloc: [[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]], max: [[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]], avail: [3,3,2], req: { p: 2, v: [1,0,2] } },
    { label: "Example 2.4.B (หน้า 62)", alloc: [[1,0,0],[6,1,2],[2,1,1],[0,0,2]], max: [[3,2,2],[6,1,3],[3,1,4],[4,2,2]], avail: [0,1,1] },
    { label: "Example 2.4.C (หน้า 63)", alloc: [[0,1,0],[2,0,0],[3,0,3],[2,1,1],[0,0,2]], max: [[0,1,0],[4,0,2],[3,0,3],[3,1,1],[0,0,4]], avail: [0,0,0] },
  ];
  const DET_PRESETS = [
    { label: "ชีท หน้า 66 ข้อ 1", alloc: [[0,1,0],[2,0,0],[3,0,3],[2,1,1],[0,0,2]], max: [[0,0,0],[2,0,2],[0,0,0],[1,0,0],[0,0,2]], avail: [0,0,0] },
    { label: "ชีท หน้า 66 ข้อ 2 (P3 ขอ R3 เพิ่ม 1)", alloc: [[0,1,0],[2,0,0],[3,0,3],[2,1,1],[0,0,2]], max: [[0,0,0],[2,0,2],[0,0,1],[1,0,0],[0,0,2]], avail: [0,0,0] },
  ];
  W.banker = function (host) {
    const detect = host.dataset.mode === "detect";
    const presets = detect ? DET_PRESETS : BANK_PRESETS;
    const second = detect ? "Request" : "Max";
    const st = JSON.parse(JSON.stringify(presets[+(host.dataset.preset || 0)]));
    const body = frame(host, detect ? "Deadlock Detection ทีละขั้น" : "Banker's Algorithm ทีละขั้น", presetSelect(presets, p => { Object.assign(st, JSON.parse(JSON.stringify(p))); build(); }));
    const grid = el("div", { class: "grid3" }), size = el("div", { class: "row" }), act = el("div", { class: "row" }), out = el("div");
    const nIn = el("input", { type: "number", min: 1, max: 8 }), mIn = el("input", { type: "number", min: 1, max: 5 });
    size.append(el("label", { class: "f" }, "จำนวนโปรเซส", nIn), el("label", { class: "f" }, "ชนิดทรัพยากร", mIn), el("button", { class: "b", onclick: resize }, "เปลี่ยนขนาด"));
    body.append(size, grid, act, out);
    function resize() {
      const n = Math.max(1, Math.min(8, +nIn.value)), m = Math.max(1, Math.min(5, +mIn.value));
      const fit = M => Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => (M[i] && M[i][j]) || 0));
      st.alloc = fit(st.alloc); st.max = fit(st.max); st.avail = Array.from({ length: m }, (_, j) => st.avail[j] || 0); build();
    }
    function matrix(title, M, onSet) {
      const t = el("table", { class: "t m" });
      t.append(el("tr", null, el("th", null, ""), M[0].map((_, j) => el("th", null, "R" + (j + 1)))));
      M.forEach((row, i) => t.append(el("tr", null, el("th", null, "P" + (i + 1)), row.map((v, j) => {
        const inp = el("input", { type: "text", value: v });
        inp.addEventListener("change", () => { onSet(i, j, parseInt(inp.value, 10) || 0); out.innerHTML = ""; });
        return el("td", null, inp);
      }))));
      return el("div", null, el("b", null, title), t);
    }
    function build() {
      nIn.value = st.alloc.length; mIn.value = st.avail.length;
      grid.innerHTML = "";
      grid.append(matrix("Allocation", st.alloc, (i, j, v) => st.alloc[i][j] = v), matrix(second, st.max, (i, j, v) => st.max[i][j] = v));
      const av = el("table", { class: "t m" }, el("tr", null, st.avail.map((_, j) => el("th", null, "R" + (j + 1)))),
        el("tr", null, st.avail.map((v, j) => { const inp = el("input", { type: "text", value: v }); inp.addEventListener("change", () => { st.avail[j] = parseInt(inp.value, 10) || 0; out.innerHTML = ""; }); return el("td", null, inp); })));
      grid.append(el("div", null, el("b", null, "Available"), av));
      act.innerHTML = "";
      if (detect) act.append(el("button", { class: "b pri", onclick: runDetect }, "ตรวจ deadlock ทีละขั้น"));
      else {
        const pSel = el("select", null, st.alloc.map((_, i) => el("option", { value: i }, "P" + (i + 1))));
        const rIn = el("input", { type: "text", value: (st.req ? st.req.v : st.avail.map(() => 0)).join(" "), style: "width:110px" });
        if (st.req) pSel.value = st.req.p - 1;
        act.append(el("button", { class: "b pri", onclick: runSafety }, "1) หา Need + ตรวจ safe"),
          el("span", { class: "muted" }, "2) ทดลอง request:"), pSel, el("span", null, "ขอ"), rIn,
          el("button", { class: "b", onclick: () => runRequest(+pSel.value, nums(rIn.value)) }, "ตรวจคำขอ"));
      }
      out.innerHTML = "";
    }
    const P = i => "P" + (i + 1);
    function stepTable(r, needLabel) {
      const t = el("table", { class: "t" }, el("tr", null, ["รอบ", "โปรเซส", needLabel + "ᵢ", "Work", needLabel + " ≤ Work ?", "Work ใหม่ = Work + Allocationᵢ"].map(h => el("th", null, h))));
      r.steps.forEach(s => t.append(el("tr", { class: s.ok ? "done" : null }, el("td", null, s.pass), el("td", null, P(s.i)), el("td", null, vec(s.need)), el("td", null, vec(s.work)),
        el("td", { class: s.ok ? "ok" : "no" }, s.ok ? "ได้ ✓" : "ไม่ได้ ✗ ข้าม"), el("td", null, s.ok ? vec(s.workAfter) : ""))));
      return el("div", { class: "tblwrap" }, t);
    }
    function needTable(need) {
      return el("div", null, el("b", null, "Need = Max − Allocation"), el("table", { class: "t m" }, el("tr", null, el("th", null, ""), need[0].map((_, j) => el("th", null, "R" + (j + 1)))),
        need.map((row, i) => el("tr", null, el("th", null, P(i)), row.map((v, j) => el("td", { title: `${st.max[i][j]} − ${st.alloc[i][j]}` }, v))))));
    }
    function runSafety() {
      const r = OS.banker.safety(st.alloc, st.max, st.avail);
      out.innerHTML = "";
      const total = OS.banker.total(st.alloc, st.avail);
      out.append(el("div", { class: "explain", html: `<b>Total ของแต่ละทรัพยากร</b> = ผลรวม Allocation + Available = <b>${vec(total)}</b>` }), needTable(r.need),
        el("p", null, `เริ่ม Work = Available = ${vec(st.avail)}, Finish ทุกตัว = false แล้วไล่ P1 → P${st.alloc.length} ตัวไหน Need ≤ Work ได้ก็ให้ทำงานจนจบแล้วคืนทรัพยากร (Work += Allocation) แล้วไล่ต่อจากตัวถัดไป วนจนไม่มีใครผ่านแล้ว`), stepTable(r, "Need"),
        el("div", { class: "explain", html: r.ok ? `<span class="big ok">Safe state ✓</span> safe sequence = <b>&lt;${r.seq.map(P).join(", ")}&gt;</b><br><span class="muted">ลำดับอื่นก็ถูกได้ ถ้าทุกขั้นผ่าน Need ≤ Work (ลำดับนี้คือไล่ต่อจากตัวถัดไปแบบในชีท)</span>` :
          `<span class="big no">Unsafe state ✗</span> ไม่มีโปรเซสไหนผ่านได้อีก: ${r.finish.map((f, i) => f ? null : P(i)).filter(Boolean).join(", ")} (unsafe ยังไม่ใช่ deadlock แต่เสี่ยงเกิด)` }));
    }
    function runRequest(i, req) {
      if (req.length !== st.avail.length) { out.innerHTML = '<div class="explain no">ใส่จำนวนให้ครบทุกชนิดทรัพยากร</div>'; return; }
      const r = OS.banker.request(st.alloc, st.max, st.avail, i, req);
      out.innerHTML = "";
      const lines = [`<b>${P(i)} ขอ Request = ${vec(req)}</b>`,
        `ขั้น 1: Request ≤ Need<sub>${i + 1}</sub> ${vec(r.need[i])} ? ${r.leNeed ? '<span class="ok">ผ่าน</span>' : '<span class="no">ไม่ผ่าน → ขอเกินที่ประกาศไว้ (error)</span>'}`];
      if (r.leNeed || !r.leAvail) lines.push(`ขั้น 2: Request ≤ Available ${vec(st.avail)} ? ${r.leAvail ? '<span class="ok">ผ่าน</span>' : '<span class="no">ไม่ผ่าน → Available ไม่พอ ต้องรอ</span>'}`);
      if (r.verdict === "grant" || r.verdict === "unsafe") lines.push(`ขั้น 3: สมมติให้ไปก่อน → Available = ${vec(r.avail2)}, Allocation<sub>${i + 1}</sub> = ${vec(r.alloc2[i])}, Need<sub>${i + 1}</sub> = ${vec(OS.banker.need(st.max, r.alloc2)[i])} แล้วตรวจ safety ใหม่:`);
      out.append(el("div", { class: "explain", html: lines.join("<br>") }));
      if (r.safety) out.append(stepTable(r.safety, "Need"));
      const verdict = { grant: `<span class="big ok">อนุมัติได้ ✓</span> หลังให้แล้วยัง safe: &lt;${r.safety ? r.safety.seq.map(P).join(", ") : ""}&gt;`, unsafe: '<span class="big no">ไม่อนุมัติ ✗</span> ถ้าให้แล้วระบบจะ unsafe → ให้รอ',
        wait: '<span class="big no">ให้ไม่ได้ตอนนี้ ✗</span> Available ไม่พอ ต้องรอ', error: '<span class="big no">ให้ไม่ได้ ✗</span> ขอเกิน Need (เกิน Max ที่ประกาศไว้)' }[r.verdict];
      let note = "";
      if (r.verdict === "error" && !r.leAvail) note = "<br><span class=\"muted\">ข้อนี้ Available ก็ไม่พอด้วย ในชีทตอบเหตุผลว่า \"Available not enough\" ซึ่งก็ถูก ผลคือให้ไม่ได้เหมือนกัน</span>";
      out.append(el("div", { class: "explain", html: verdict + note }));
      if (r.verdict === "grant") {
        out.append(el("div", { class: "row" }, el("button", { class: "b pri", onclick: () => {
          st.alloc = r.alloc2; st.avail = r.avail2; st.req = null; build();
          out.append(el("div", { class: "explain", html: `ให้ ${P(i)} ไปแล้ว: Available ใหม่ = <b>${vec(st.avail)}</b> ตารางด้านบนอัปเดตแล้ว ลองตรวจคำขอถัดไปได้เลย (ชีทให้ลอง P4 ขอ (3,3,0) แล้วต่อด้วย P1 ขอ (0,2,0))` }));
        } }, "✔ ให้จริง แล้วใช้สถานะใหม่ต่อ (แบบในชีท)")));
      }
    }
    function runDetect() {
      const r = OS.detect(st.alloc, st.max, st.avail);
      out.innerHTML = "";
      out.append(el("p", null, `Work = Available = ${vec(st.avail)} แล้วไล่หาโปรเซสที่ Request ≤ Work (ถ้า Allocation เป็น 0 ทั้งแถว ถือว่า Finish = true ตั้งแต่ต้น)`), stepTable(r, "Request"),
        el("div", { class: "explain", html: r.deadlocked.length ? `<span class="big no">เกิด deadlock ✗</span> โปรเซสที่ติด: <b>${r.deadlocked.map(P).join(", ")}</b> (Finish = false)` :
          `<span class="big ok">ไม่เกิด deadlock ✓</span> ทุกโปรเซสทำงานจบได้ ลำดับ &lt;${r.seq.map(P).join(", ")}&gt;` }));
    }
    build();
  };

  /* =====================================================================
     5) Resource-allocation graph: วาดจาก matrix + หา cycle + ตรวจ deadlock
     ===================================================================== */
  const RAG_PRESETS = [
    { label: "รูป 2.4.B (ไม่มี cycle)", inst: [1,2,1,3], alloc: [[0,1,0,0],[1,1,0,0],[0,0,1,0]], req: [[1,0,0,0],[0,0,1,0],[0,0,0,0]] },
    { label: "รูป 2.4.C (มี cycle + deadlock)", inst: [1,2,1,3], alloc: [[0,1,0,0],[1,1,0,0],[0,0,1,0]], req: [[1,0,0,0],[0,0,1,0],[0,1,0,0]] },
    { label: "รูป 2.4.D (มี cycle แต่ไม่ deadlock)", inst: [2,2], alloc: [[0,1],[1,0],[1,0],[0,1]], req: [[1,0],[0,0],[0,1],[0,0]] },
    { label: "ชีวิตจริง: การบ้าน ห้องแล็บ 3 คน 3 อุปกรณ์", pn: ["นักศึกษา 1", "นักศึกษา 2", "นักศึกษา 3"], rn: ["Printer", "Projector", "Notebook"],
      inst: [1,1,1], alloc: [[1,0,0],[0,1,0],[0,0,1]], req: [[0,1,0],[0,0,1],[1,0,0]] },
    { label: "ชีวิตจริง: ห้องแล็บ แต่มี Projector 2 เครื่อง", pn: ["นักศึกษา 1", "นักศึกษา 2", "นักศึกษา 3"], rn: ["Printer", "Projector", "Notebook"],
      inst: [1,2,1], alloc: [[1,0,0],[0,1,0],[0,0,1]], req: [[0,1,0],[0,0,1],[1,0,0]] },
    { label: "ชีวิตจริง: กินข้าว ช้อนกับส้อม (2 คน)", pn: ["คน A", "คน B"], rn: ["ช้อน", "ส้อม"],
      inst: [1,1], alloc: [[1,0],[0,1]], req: [[0,1],[1,0]] },
    { label: "ชีวิตจริง: สี่แยก รถ 4 คัน (รูป 2.4.A)", pn: ["รถ 1", "รถ 2", "รถ 3", "รถ 4"], rn: ["ช่อง 1", "ช่อง 2", "ช่อง 3", "ช่อง 4"],
      inst: [1,1,1,1], alloc: [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]], req: [[0,1,0,0],[0,0,1,0],[0,0,0,1],[1,0,0,0]] },
  ];
  W.rag = function (host) {
    const st = JSON.parse(JSON.stringify(RAG_PRESETS[+(host.dataset.preset || 0)]));
    const body = frame(host, "Resource-Allocation Graph ↔ Allocation / Request matrix", presetSelect(RAG_PRESETS, p => { delete st.pn; delete st.rn; Object.assign(st, JSON.parse(JSON.stringify(p))); build(); }));
    const grid = el("div", { class: "grid3" }), pic = el("div"), out = el("div", { class: "explain" });
    body.append(el("p", { class: "muted" }, "แก้ตัวเลขในตารางได้ แล้วกราฟจะวาดใหม่ทันที: ลูกศร P → R = ขอ (request) และลูกศร R → P = ได้ไปแล้ว (allocation) จุดในกล่อง R คือจำนวน instance"), grid, pic, out);
    function mtx(title, M, cols) {
      const t = el("table", { class: "t m" }, el("tr", null, el("th", null, ""), cols.map(c => el("th", null, c))));
      M.forEach((row, i) => t.append(el("tr", null, el("th", null, "P" + (i + 1)), row.map((v, j) => {
        const inp = el("input", { type: "text", value: v }); inp.addEventListener("input", () => { M[i][j] = parseInt(inp.value, 10) || 0; draw(); }); return el("td", null, inp);
      }))));
      return el("div", null, el("b", null, title), t);
    }
    function build() {
      const cols = st.inst.map((_, j) => "R" + (j + 1));
      grid.innerHTML = "";
      const it = el("table", { class: "t m" }, el("tr", null, cols.map(c => el("th", null, c))), el("tr", null, st.inst.map((v, j) => {
        const inp = el("input", { type: "text", value: v }); inp.addEventListener("input", () => { st.inst[j] = parseInt(inp.value, 10) || 0; draw(); }); return el("td", null, inp);
      })));
      grid.append(mtx("Allocation (R → P)", st.alloc, cols), mtx("Request (P → R)", st.req, cols), el("div", null, el("b", null, "จำนวน instance"), it));
      draw();
    }
    function draw() {
      const n = st.alloc.length, m = st.inst.length, Wd = Math.max(420, Math.max(n, m) * 130), Ht = st.rn ? 330 : 300;
      const px = i => (i + 0.5) * Wd / n, rx = j => (j + 0.5) * Wd / m, py = 60, ry = 220;
      const used = st.inst.map((_, j) => st.alloc.reduce((s, r) => s + r[j], 0));
      const avail = st.inst.map((v, j) => v - used[j]);
      const cycles = OS.rag.cycles(st.alloc, st.req);
      const det = OS.detect(st.alloc, st.req, avail);
      const dead = new Set(det.deadlocked.map(i => "P" + i));
      const hot = new Set();
      if (det.deadlocked.length) cycles.forEach(c => { if (c.some(x => dead.has(x))) for (let k = 0; k + 1 < c.length; k++) hot.add(c[k] + ">" + c[k + 1]); });
      const g = svg("svg", { viewBox: `0 ${st.pn ? -20 : 0} ${Wd} ${Ht + (st.pn ? 20 : 0)}`, width: "100%", style: `max-width:${Wd}px` });
      g.append(svg("defs", null, ["#555", "#3157d5", "#c43d3d"].map((c, k) => svg("marker", { id: "ah" + k + host.dataset.uid, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, svg("path", { d: "M0,0 L10,5 L0,10 z", fill: c })))));
      const line = (x1, y1, x2, y2, color, k, dash) => {
        const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
        return svg("line", { x1: x1 + ux * 30, y1: y1 + uy * 30, x2: x2 - ux * 34, y2: y2 - uy * 34, stroke: color, "stroke-width": 2, "marker-end": `url(#ah${k}${host.dataset.uid})`, "stroke-dasharray": dash || "" });
      };
      st.alloc.forEach((row, i) => row.forEach((v, j) => { if (v > 0) { const h = hot.has("R" + j + ">P" + i); g.append(line(rx(j) - 8, ry, px(i) + 8, py, h ? "#c43d3d" : "#555", h ? 2 : 0)); if (v > 1) g.append(svg("text", { x: (rx(j) + px(i)) / 2 - 18, y: (ry + py) / 2, "font-size": 12 }, "×" + v)); } }));
      st.req.forEach((row, i) => row.forEach((v, j) => { if (v > 0) { const h = hot.has("P" + i + ">R" + j); g.append(line(px(i) - 8, py, rx(j) + 8, ry, h ? "#c43d3d" : "#3157d5", h ? 2 : 1, "6 4")); if (v > 1) g.append(svg("text", { x: (rx(j) + px(i)) / 2 + 6, y: (ry + py) / 2, "font-size": 12, fill: "#3157d5" }, "×" + v)); } }));
      for (let i = 0; i < n; i++) g.append(svg("circle", { cx: px(i), cy: py, r: 26, fill: dead.has("P" + i) ? "#fbe7e7" : "#e8eaee", stroke: dead.has("P" + i) ? "#c43d3d" : "#666", "stroke-width": 1.5 }), svg("text", { x: px(i), y: py + 5, "text-anchor": "middle", "font-size": 15 }, "P" + (i + 1)),
        st.pn && st.pn[i] ? svg("text", { x: px(i), y: py - 34, "text-anchor": "middle", "font-size": 12, fill: "#555" }, st.pn[i]) : svg("g"));
      for (let j = 0; j < m; j++) {
        const k = st.inst[j], h = Math.max(36, 14 * k + 10);
        g.append(svg("rect", { x: rx(j) - 22, y: ry - h / 2, width: 44, height: h, fill: "#fff", stroke: "#444", "stroke-width": 1.5 }));
        for (let q = 0; q < k; q++) g.append(svg("circle", { cx: rx(j), cy: ry - h / 2 + 12 + q * 14, r: 4, fill: q < used[j] ? "#555" : "#fff", stroke: "#555" }));
        g.append(svg("text", { x: rx(j), y: ry + h / 2 + 18, "text-anchor": "middle", "font-size": 14 }, "R" + (j + 1)));
        if (st.rn && st.rn[j]) g.append(svg("text", { x: rx(j), y: ry + h / 2 + 34, "text-anchor": "middle", "font-size": 12, fill: "#555" }, st.rn[j]));
      }
      pic.innerHTML = ""; pic.append(g, el("div", { class: "legend" }, el("span", null, "── R → P ได้ไปแล้ว"), el("span", { style: "color:#3157d5" }, "- - P → R ขอ"), el("span", null, "● = instance ที่ถูกใช้, ○ = ว่าง")));
      const name = s => s.replace(/P(\d+)/g, (_, k) => "P" + (+k + 1)).replace(/R(\d+)/g, (_, k) => "R" + (+k + 1));
      const multi = st.inst.some(v => v > 1);
      const who = (st.pn ? st.pn.map((x, i) => `P${i + 1} = ${x}`) : []).concat(st.rn ? st.rn.map((x, j) => `R${j + 1} = ${x}`) : []);
      out.innerHTML = (who.length ? `<span class="muted">${who.join(" · ")}</span><br>` : "") + `<b>Available</b> = ${vec(avail)}<br>` +
        (cycles.length ? `<b>Cycle ที่พบ (${cycles.length})</b>: ${cycles.map(c => name(c.join(" → "))).join("<br>")}` : "<b>ไม่มี cycle</b> → ไม่เกิด deadlock แน่นอน") + "<br>" +
        (det.deadlocked.length ? `<span class="big no">Deadlock ✗</span> โปรเซสที่ติด: ${det.deadlocked.map(i => "P" + (i + 1)).join(", ")} (ไล่ detection แล้วไม่มีใครได้ตามที่ขอ)` :
          `<span class="big ok">ไม่เกิด deadlock ✓</span> ไล่ได้ครบ: &lt;${det.seq.map(i => "P" + (i + 1)).join(", ")}&gt;` + (cycles.length ? `<br><span class="muted">มี cycle แต่ไม่ deadlock เพราะทรัพยากรมีหลาย instance และมีโปรเซสนอก cycle ที่คืนทรัพยากรได้ (cycle = เงื่อนไขจำเป็น ไม่ใช่เงื่อนไขพอเพียง)</span>` : "")) +
        (!multi && cycles.length ? '<br><span class="muted">ทุกทรัพยากรมี 1 instance → มี cycle = deadlock แน่นอน</span>' : "");
    }
    host.dataset.uid = Math.random().toString(36).slice(2, 7);
    build();
  };

  /* =====================================================================
     6) Paging: logical → physical
     ===================================================================== */
  const PG_PRESETS = [
    { label: "ชีทรูป 3.1.M: 32 byte, page 4 byte", size: 4, table: "5 6 1 2", addr: "0 3 4 5 10 13", bits: 5 },
    { label: "ชีทรูป 3.1.N: 16 บิต, page 1 KB", size: 1024, table: "5 6 25", addr: "1502 3000", bits: 16 },
    { label: "ชีทรูป 3.1.L: page table 1 4 3 7", size: 4, table: "1 4 3 7", addr: "0 5 9 14", bits: 5 },
  ];
  W.paging = function (host) {
    const p0 = PG_PRESETS[+(host.dataset.preset || 0)];
    const body = frame(host, "แปลง logical address → physical address (paging)", presetSelect(PG_PRESETS, p => { sIn.value = p.size; tIn.value = p.table; aIn.value = p.addr; bIn.value = p.bits; go(); }));
    const sIn = el("input", { type: "number", value: p0.size }), tIn = el("input", { type: "text", value: p0.table, style: "width:160px" });
    const aIn = el("input", { type: "text", value: p0.addr, style: "width:180px" }), bIn = el("input", { type: "number", value: p0.bits });
    const out = el("div");
    body.append(el("div", { class: "row" }, el("label", { class: "f" }, "page size", sIn), el("label", { class: "f" }, "page table (เฟรมของเพจ 0,1,2,…)", tIn)),
      el("div", { class: "row" }, el("label", { class: "f" }, "logical address", aIn), el("label", { class: "f" }, "จำนวนบิตของ address", bIn), el("button", { class: "b pri", onclick: go }, "แปลง")), out);
    function go() {
      const size = +sIn.value, table = nums(tIn.value), bits = +bIn.value;
      const pow = Number.isInteger(Math.log2(size));
      const dBits = pow ? Math.log2(size) : null;
      const t = el("table", { class: "t" }, el("tr", null, ["logical", "p = ⌊logical ÷ " + size + "⌋", "d = logical mod " + size, "f = table[p]", "physical = f×" + size + " + d"].map(h => el("th", null, h))));
      const bin = [];
      nums(aIn.value).forEach(a => {
        const r = OS.paging.translate(a, size, table);
        t.append(el("tr", null, el("td", null, a), el("td", null, r.p), el("td", null, r.d), el("td", null, r.valid ? r.f : "ไม่มี (trap)"), el("td", null, r.valid ? `${r.f}×${size}+${r.d} = ${r.physical}` : "—")));
        if (pow && bits > dBits && r.valid) {
          const pb = bits - dBits, b = (v, w) => v.toString(2).padStart(w, "0");
          bin.push(`logical ${a}  = <b>${b(r.p, pb)}</b> ${b(r.d, dBits)}  (p=${r.p}, d=${r.d})\nphysical ${r.physical} = <b>${b(r.f, pb)}</b> ${b(r.d, dBits)}  (f=${r.f}, d เท่าเดิม)`);
        }
      });
      out.innerHTML = "";
      out.append(el("div", { class: "tblwrap" }, t));
      if (pow && bits > dBits) out.append(el("div", { class: "explain", html: `page size = ${size} = 2<sup>${dBits}</sup> → d ใช้ <b>${dBits} บิต</b>, p ใช้ ${bits} − ${dBits} = <b>${bits - dBits} บิต</b> → มีได้ 2<sup>${bits - dBits}</sup> = ${2 ** (bits - dBits)} เพจ` }),
        el("pre", { html: bin.join("\n\n") }));
    }
    go();
  };

  /* =====================================================================
     7) relocation / base-limit
     ===================================================================== */
  W.reloc = function (host) {
    const body = frame(host, "Relocation (base) register + limit register");
    const bIn = el("input", { type: "number", value: 14000, style: "width:100px" }), lIn = el("input", { type: "number", value: 1000, style: "width:100px" }), aIn = el("input", { type: "number", value: 346, style: "width:100px" });
    const out = el("div", { class: "explain" });
    [bIn, lIn, aIn].forEach(x => x.addEventListener("input", go));
    body.append(el("div", { class: "row" }, el("label", { class: "f" }, "base", bIn), el("label", { class: "f" }, "limit", lIn), el("label", { class: "f" }, "logical address (CPU ส่งมา)", aIn)), out);
    function go() {
      const b = +bIn.value, l = +lIn.value, a = +aIn.value;
      out.innerHTML = a < l ? `ขั้น 1: ${a} &lt; limit ${l} ? <span class="ok">ใช่</span><br>ขั้น 2: physical = base + logical = ${b} + ${a} = <span class="big">${b + a}</span>` :
        `ขั้น 1: ${a} &lt; limit ${l} ? <span class="no">ไม่ใช่</span> → <span class="big no">trap: addressing error</span> (ไม่เอาไปบวก base)`;
    }
    go();
  };

  /* =====================================================================
     8) first / best / worst fit
     ===================================================================== */
  W.fit = function (host) {
    const body = frame(host, "Placement strategy: first-fit / best-fit / worst-fit");
    const hIn = el("input", { type: "text", value: host.dataset.holes || "100 500 200 300 600", style: "width:220px" });
    const pIn = el("input", { type: "text", value: host.dataset.procs || "212 417 112 426", style: "width:220px" });
    const out = el("div", { class: "grid3" });
    body.append(el("div", { class: "row" }, el("label", { class: "f" }, "hole ว่าง (K) เรียงตาม address", hIn), el("label", { class: "f" }, "โปรเซสที่เข้ามาตามลำดับ (K)", pIn), el("button", { class: "b pri", onclick: go }, "วาง")), out);
    function go() {
      const holes = nums(hIn.value), procs = nums(pIn.value);
      out.innerHTML = "";
      [["first", "First-fit — hole แรกที่พอ"], ["best", "Best-fit — hole เล็กสุดที่พอ"], ["worst", "Worst-fit — hole ใหญ่สุด"]].forEach(([h, title]) => {
        const r = OS.fit(holes, procs, h);
        const lines = r.placements.map(p => p.hole < 0 ? `<span class="no">${p.size}K → ไม่มีที่พอ ต้องรอ</span>` : `${p.size}K → hole ${p.hole + 1} (${p.before}K เหลือ ${p.after}K)`);
        const ok = r.placements.every(p => p.hole >= 0);
        out.append(el("div", { class: "card", html: `<b>${title}</b><br>${lines.join("<br>")}<br><span class="muted">hole หลังวาง: ${r.holes.map(x => x.size + "K").join(", ")}</span><br>${ok ? '<span class="ok">วางครบทุกโปรเซส</span>' : '<span class="no">มีโปรเซสที่ต้องรอ</span>'}` }));
      });
    }
    go();
  };

  /* =====================================================================
     9) Multiple-partition + RR (ตัวอย่าง 3.1.ก)
     ===================================================================== */
  W.rrmem = function (host) {
    const body = frame(host, "Multiple-partition + RR (ตัวอย่าง 3.1.ก) — ดูหน่วยความจำเปลี่ยนทีละเหตุการณ์");
    const jobs = [{ name: "P1", size: 600, burst: 10 }, { name: "P2", size: 1000, burst: 5 }, { name: "P3", size: 300, burst: 20 }, { name: "P4", size: 700, burst: 8 }, { name: "P5", size: 500, burst: 15 }];
    const total = 2560, osSize = 400;
    const r = OS.partitionRR(total, osSize, jobs, 1);
    let k = 0;
    const pic = el("div"), info = el("div", { class: "explain" });
    const slider = el("input", { type: "range", min: 0, max: r.events.length - 1, value: 0, style: "width:min(420px,100%)" });
    slider.addEventListener("input", () => { k = +slider.value; draw(); });
    body.append(el("p", { class: "muted" }, "ข้อมูล: หน่วยความจำ 2560K, OS 400K, low memory + first-fit, RR quantum = 1 ms, job queue = P1(600K,10) P2(1000K,5) P3(300K,20) P4(700K,8) P5(500K,15)"),
      el("div", { class: "row" }, el("button", { class: "b", onclick: () => { if (k > 0) { k--; slider.value = k; draw(); } } }, "◀"), slider, el("button", { class: "b pri", onclick: () => { if (k < r.events.length - 1) { k++; slider.value = k; draw(); } } }, "▶")), pic, info);
    function draw() {
      const e = r.events[k], Ht = 330, Wd = 360, Y = v => 10 + v * (Ht - 20) / total;
      const g = svg("svg", { viewBox: `0 0 ${Wd} ${Ht}`, width: "100%", style: "max-width:380px" });
      g.append(svg("rect", { x: 90, y: Y(0), width: 150, height: Y(total) - Y(0), fill: "#fff", stroke: "#444" }));
      g.append(svg("rect", { x: 90, y: Y(0), width: 150, height: Y(osSize) - Y(0), fill: "#d9dce2", stroke: "#444" }), svg("text", { x: 165, y: Y(osSize / 2) + 5, "text-anchor": "middle" }, "OS"));
      e.map.forEach(b => {
        g.append(svg("rect", { x: 90, y: Y(b.start), width: 150, height: Y(b.end) - Y(b.start), fill: b.name === e.name && e.type === "alloc" ? "#ffe9a8" : "#dfe7fb", stroke: "#444" }),
          svg("text", { x: 165, y: (Y(b.start) + Y(b.end)) / 2 + 5, "text-anchor": "middle" }, b.name));
      });
      e.holes.forEach(h => g.append(svg("text", { x: 165, y: (Y(h[0]) + Y(h[1])) / 2 + 4, "text-anchor": "middle", "font-size": 11, fill: "#888" }, `ว่าง ${h[1] - h[0]}K`)));
      const marks = new Set([0, osSize, total]); e.map.forEach(b => { marks.add(b.start); marks.add(b.end); }); e.holes.forEach(h => { marks.add(h[0]); marks.add(h[1]); });
      [...marks].sort((a, b) => a - b).forEach(v => g.append(svg("text", { x: 84, y: Y(v) + 4, "text-anchor": "end", "font-size": 11 }, v + "K")));
      pic.innerHTML = ""; pic.append(g);
      info.innerHTML = `<span class="big">t = ${e.t} ms: ${e.type === "alloc" ? `วาง ${e.name} ที่ ${e.start}K–${e.end}K` : `${e.name} ทำงานจบ (terminate) คืนพื้นที่ ${e.start}K–${e.end}K`}</span>` +
        (k === 0 ? "<br>ตอนเริ่ม P1+P2+P3 = 1900K พอใส่ แต่ P4 (700K) เหลือที่ว่างแค่ 260K จึงต้องรอใน job queue (FCFS: P5 ข้ามคิว P4 ไม่ได้)" : "") +
        (e.name === "P2" && e.type === "terminate" ? "<br>RR วน P1, P2, P3 ทีละ 1 ms → P2 ได้รันเวลา 1, 4, 7, 10, 13 ครบ 5 ms จึงจบตอนสิ้นสุดเวลาที่ 14" : "");
    }
    draw();
  };

  /* =====================================================================
     10) Disk scheduling
     ===================================================================== */
  W.disk = function (host) {
    const d = host.dataset;
    const st = { algo: d.algo || "FCFS" };
    const presets = [{ label: "ชีท 3.3.4: head 53", q: "98 183 37 122 14 124 65 67", h: 53 }, { label: "ฝึก: head 50", q: "82 170 43 140 24 16 190", h: 50 }];
    const body = frame(host, "Disk scheduling — total head movement", presetSelect(presets, p => { qIn.value = p.q; hIn.value = p.h; go(); }));
    const qIn = el("input", { type: "text", class: "wide", value: d.queue || presets[0].q }), hIn = el("input", { type: "number", value: d.head || 53 }), mIn = el("input", { type: "number", value: 199 });
    let dir = "down";
    const out = el("div"), calc = el("div", { class: "explain" });
    body.append(el("div", { class: "row" }, el("label", { class: "f" }, "คิว", qIn)),
      el("div", { class: "row" }, el("label", { class: "f" }, "หัวอ่านอยู่ที่", hIn), el("label", { class: "f" }, "track สุดท้าย", mIn),
        seg([["down", "กำลังไปทาง 0"], ["up", "กำลังไปทาง track สูง"]], dir, v => { dir = v; go(); })),
      el("div", { class: "row" }, seg(["FCFS", "SSTF", "SCAN", "C-SCAN", "LOOK", "C-LOOK"].map(a => [a, a]), st.algo, a => { st.algo = a; go(); }), el("button", { class: "b", onclick: all }, "เทียบทุกวิธี")),
      out, calc);
    [qIn, hIn, mIn].forEach(x => x.addEventListener("change", go));
    function go() {
      const q = nums(qIn.value), h = +hIn.value, mx = +mIn.value;
      const r = OS.disk(q, h, mx, dir, st.algo);
      const Wd = 640, step = 26, Ht = 46 + step * r.path.length, L = 20, R = Wd - 20, X = v => L + v * (R - L) / mx;
      const g = svg("svg", { viewBox: `0 0 ${Wd} ${Ht}`, width: "100%", style: "max-width:680px;background:#fafbfc;border:1px solid #e3e5e8;border-radius:8px" });
      const ticks = [...new Set([0, mx, h].concat(q))].sort((a, b) => a - b);
      ticks.forEach((v, k) => g.append(svg("line", { x1: X(v), x2: X(v), y1: 26, y2: Ht - 6, stroke: "#eceef1" }), svg("text", { x: X(v), y: 11 + (k % 2) * 10, "text-anchor": "middle", "font-size": 10, fill: v === h ? "#3157d5" : "#555" }, v)));
      for (let k = 1; k < r.path.length; k++) {
        const t = r.terms[k - 1];
        g.append(svg("line", { x1: X(r.path[k - 1]), y1: 36 + (k - 1) * step, x2: X(r.path[k]), y2: 36 + k * step, stroke: t.jump ? "#999" : "#c43d3d", "stroke-width": 2, "stroke-dasharray": t.jump ? "5 4" : "" }));
      }
      r.path.forEach((v, k) => g.append(svg("circle", { cx: X(v), cy: 36 + k * step, r: 4, fill: k === 0 ? "#3157d5" : "#c43d3d" })));
      out.innerHTML = ""; out.append(g);
      calc.innerHTML = `<b>${st.algo}</b> ลำดับ: ${r.path.join(" → ")}<br>total head movement = ${r.terms.map(t => `(${Math.max(t.from, t.to)} − ${Math.min(t.from, t.to)})${t.jump ? "*" : ""}`).join(" + ")}<br>= ${r.terms.map(t => t.dist).join(" + ")} = <span class="big">${r.total} tracks</span>` +
        (r.terms.some(t => t.jump) ? '<br><span class="muted">* = ช่วงที่หัวอ่านกระโดดกลับ (ชีทนับระยะนี้ด้วย)</span>' : "") +
        { FCFS: "<br>FCFS: ไปตามลำดับคิว", SSTF: "<br>SSTF: ทุกครั้งเลือก track ที่ใกล้หัวอ่านที่สุด", SCAN: "<br>SCAN: วิ่งไปจนสุดปลายดิสก์ แล้วกลับมาบริการอีกทาง", "C-SCAN": "<br>C-SCAN: บริการทางเดียว ถึงปลายแล้วกระโดดไปอีกปลาย", LOOK: "<br>LOOK: เหมือน SCAN แต่ไม่ต้องไปถึงปลาย กลับที่ request สุดท้าย", "C-LOOK": "<br>C-LOOK: เหมือน C-SCAN แต่กระโดดจาก request สุดท้ายไป request ไกลสุดอีกฝั่ง" }[st.algo];
    }
    function all() {
      const q = nums(qIn.value), h = +hIn.value, mx = +mIn.value;
      calc.innerHTML = "<b>เทียบทุกวิธี</b><br>" + ["FCFS", "SSTF", "SCAN", "C-SCAN", "LOOK", "C-LOOK"].map(a => `${a} = ${OS.disk(q, h, mx, dir, a).total}`).join(" · ");
    }
    go();
  };

  /* =====================================================================
     11) Bit vector
     ===================================================================== */
  W.bitvec = function (host) {
    const body = frame(host, "Bit vector (bit map) ของพื้นที่ว่าง");
    const nIn = el("input", { type: "number", value: host.dataset.n || 12 }), fIn = el("input", { type: "text", value: host.dataset.free || "2 3 4 6 8 9 10", style: "width:200px" });
    let fb = 0;
    const out = el("div");
    body.append(el("div", { class: "row" }, el("label", { class: "f" }, "จำนวนบล็อก", nIn), el("label", { class: "f" }, "บล็อกว่าง", fIn),
      seg([[0, "ตามชีท: ว่าง = 0"], [1, "ตามตำราฝรั่ง: ว่าง = 1"]], 0, v => { fb = v; go(); })), out);
    [nIn, fIn].forEach(x => x.addEventListener("input", go));
    function go() {
      const n = Math.min(64, +nIn.value), bits = OS.bitVector(n, nums(fIn.value), fb);
      out.innerHTML = "";
      out.append(el("div", { class: "tblwrap" }, el("table", { class: "t" }, el("tr", null, el("th", null, "Bit no."), bits.map((_, k) => el("th", null, k))), el("tr", null, el("th", null, "Value"), bits.map(b => el("td", { style: b === fb ? "background:var(--good-soft)" : "" }, b))))),
        el("div", { class: "explain", html: `bit vector = <b class="mono">${bits.join("")}</b> <span class="muted">(ช่องสีเขียว = บล็อกว่าง)</span>` }));
    }
    go();
  };

  /* =====================================================================
     12) สิทธิ์ rwx
     ===================================================================== */
  W.perm = function (host) {
    const body = frame(host, "สิทธิ์ไฟล์ 3 level × 3 bit (rwx)");
    let bits = OS.perm.fromString(host.dataset.perm || "rwxr-xr--");
    const t = el("table", { class: "t" }), out = el("div", { class: "explain" });
    const oIn = el("input", { type: "text", style: "width:70px" });
    oIn.addEventListener("input", () => { if (/^[0-7]{3}$/.test(oIn.value)) { bits = OS.perm.fromOctal(oIn.value); draw(false); } });
    body.append(el("div", { class: "row" }, el("label", { class: "f" }, "หรือพิมพ์เลข 3 หลัก (เช่น 640)", oIn)), t, out);
    function draw(setO) {
      t.innerHTML = "";
      t.append(el("tr", null, el("th", null, ""), ["r (4)", "w (2)", "x (1)", "รวม"].map(h => el("th", null, h))));
      ["owner (เจ้าของ)", "group (กลุ่ม)", "others (คนอื่น)"].forEach((who, g) => {
        t.append(el("tr", null, el("th", null, who), [0, 1, 2].map(k => {
          const c = el("input", { type: "checkbox" }); c.checked = bits[g][k];
          c.addEventListener("change", () => { bits[g][k] = c.checked; draw(true); });
          return el("td", null, c);
        }), el("td", { class: "mono" }, (bits[g][0] ? 4 : 0) + (bits[g][1] ? 2 : 0) + (bits[g][2] ? 1 : 0))));
      });
      const oct = OS.perm.toOctal(bits);
      if (setO !== false) oIn.value = oct;
      const say = g => { const a = []; if (bits[g][0]) a.push("อ่าน"); if (bits[g][1]) a.push("เขียน"); if (bits[g][2]) a.push("รัน"); return a.length ? a.join("/") : "ทำอะไรไม่ได้"; };
      out.innerHTML = `<span class="big mono">${OS.perm.toString(bits)} = ${oct}</span> &nbsp; <code>chmod ${oct} file</code><br>เจ้าของ: ${say(0)} · กลุ่ม: ${say(1)} · คนอื่น: ${say(2)}`;
    }
    draw(true);
  };

  /* =====================================================================
     13) FSM: นิยามระบบที่ secure
     ===================================================================== */
  W.fsm = function (host) {
    const body = frame(host, "ระบบที่ secure = transition ไม่ออกจาก secure set");
    const states = [{ id: "S0", x: 90, y: 150 }, { id: "S1", x: 250, y: 120 }, { id: "S2", x: 330, y: 215 }, { id: "S3", x: 520, y: 170 }];
    const secure = ["S0", "S1", "S2"];
    const base = [{ from: "S0", sym: "a", to: "S1" }, { from: "S1", sym: "a", to: "S1" }, { from: "S1", sym: "b", to: "S2" }, { from: "S2", sym: "a", to: "S0" }, { from: "S2", sym: "b", to: "S3" }];
    let patched = false;
    const inIn = el("input", { type: "text", value: "abb", style: "width:120px" });
    const pic = el("div"), out = el("div", { class: "explain" });
    const bPatch = el("button", { class: "b" }, "🛠 ปิดช่องโหว่ (patch)");
    bPatch.addEventListener("click", () => { patched = !patched; bPatch.textContent = patched ? "↩ เอาช่องโหว่กลับมา" : "🛠 ปิดช่องโหว่ (patch)"; draw(); });
    inIn.addEventListener("input", draw);
    body.append(el("div", { class: "row" }, el("label", { class: "f" }, "ป้อน input (a/b) เริ่มที่ S0", inIn), bPatch), pic, out);
    function draw() {
      const trans = patched ? base.filter(t => !(t.from === "S2" && t.to === "S3")) : base;
      const path = OS.fsm.run(trans, "S0", inIn.value.replace(/[^ab]/g, ""));
      const viol = OS.fsm.violations(trans, secure);
      const pos = Object.fromEntries(states.map(s => [s.id, s]));
      const g = svg("svg", { viewBox: "0 0 620 260", width: "100%", style: "max-width:640px" });
      g.append(svg("defs", null, svg("marker", { id: "fa", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, svg("path", { d: "M0,0 L10,5 L0,10 z", fill: "#555" })),
        svg("marker", { id: "fr", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, svg("path", { d: "M0,0 L10,5 L0,10 z", fill: "#c43d3d" }))));
      g.append(svg("path", { d: "M20,20 L420,20 L420,250 L20,250 Z", fill: "#e3f4ea", stroke: "#8fd0aa", "stroke-dasharray": "6 4" }), svg("text", { x: 30, y: 40, "font-size": 13, fill: "#1a7f4b" }, "secured set"),
        svg("text", { x: 470, y: 40, "font-size": 13, fill: "#c43d3d" }, "non-secure"));
      trans.forEach(t => {
        const a = pos[t.from], b = pos[t.to], bad = !secure.includes(t.to);
        if (t.from === t.to) {
          g.append(svg("path", { d: `M${a.x - 12},${a.y - 26} C${a.x - 40},${a.y - 80} ${a.x + 40},${a.y - 80} ${a.x + 12},${a.y - 26}`, fill: "none", stroke: "#555", "stroke-width": 1.8, "marker-end": "url(#fa)" }),
            svg("text", { x: a.x, y: a.y - 66, "text-anchor": "middle", "font-size": 14 }, t.sym));
          return;
        }
        const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy * 10, ny = ux * 10;
        g.append(svg("line", { x1: a.x + ux * 28 + nx, y1: a.y + uy * 28 + ny, x2: b.x - ux * 30 + nx, y2: b.y - uy * 30 + ny, stroke: bad ? "#c43d3d" : "#555", "stroke-width": bad ? 2.6 : 1.8, "marker-end": bad ? "url(#fr)" : "url(#fa)" }),
          svg("text", { x: (a.x + b.x) / 2 + nx * 2, y: (a.y + b.y) / 2 + ny * 2 + 5, "text-anchor": "middle", "font-size": 14, fill: bad ? "#c43d3d" : "#222" }, t.sym));
      });
      states.forEach(s => {
        const on = path[path.length - 1] === s.id, sec = secure.includes(s.id);
        g.append(svg("circle", { cx: s.x, cy: s.y, r: 26, fill: on ? "#ffe9a8" : (sec ? "#fff" : "#fbe7e7"), stroke: sec ? "#1a7f4b" : "#c43d3d", "stroke-width": 2 }),
          svg("text", { x: s.x, y: s.y + 5, "text-anchor": "middle", "font-size": 15 }, s.id));
      });
      pic.innerHTML = ""; pic.append(g);
      const end = path[path.length - 1];
      out.innerHTML = `เส้นทาง: <b>${path.map(x => x || "(ไม่มี transition)").join(" → ")}</b> → จบที่ ${end ? (secure.includes(end) ? '<span class="ok">' + end + " (secure)</span>" : '<span class="no">' + end + " (non-secure!)</span>") : '<span class="muted">ค้าง (ไม่มี transition)</span>'}<br>` +
        (viol.length ? `<span class="big no">ระบบไม่ secure</span> เพราะมี transition ${viol.map(t => `${t.from} -${t.sym}-> ${t.to}`).join(", ")} ออกไป non-secure (เหมือนช่องโหว่ / backdoor) → ต้องปิด transition หรือเหตุการณ์ที่ trigger นั้น` :
          '<span class="big ok">ระบบ secure ✓</span> ไม่ว่าป้อน input อะไร ก็วนอยู่ใน secure set เสมอ');
    }
    draw();
  };

  /* =====================================================================
     14) สุ่มโจทย์ฝึก
     ===================================================================== */
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  W.gen = function (host) {
    const kind = host.dataset.kind || "pr";
    const titles = { pr: "สุ่มโจทย์ page replacement", disk: "สุ่มโจทย์ disk scheduling", paging: "สุ่มโจทย์แปลง address (paging)", banker: "สุ่มโจทย์ Banker's" };
    const body = frame(host, titles[kind]);
    const q = el("div"), row = el("div", { class: "row" }), sol = el("div");
    const inp = el("input", { type: "text", style: "min-width:200px" }), chk = el("button", { class: "b pri" }, "ตรวจ"), show = el("button", { class: "b" }, "ดูเฉลย"), again = el("button", { class: "b" }, "🎲 สุ่มข้อใหม่"), verdict = el("span");
    row.append(inp, chk, show, again, verdict);
    body.append(q, row, sol);
    let cur;
    again.addEventListener("click", make);
    chk.addEventListener("click", () => { const ok = cur.check(inp.value); verdict.className = ok ? "ok" : "no"; verdict.textContent = ok ? " ✓ ถูกต้อง!" : " ✗ ยังไม่ถูก"; });
    inp.addEventListener("keydown", e => { if (e.key === "Enter") chk.click(); });
    show.addEventListener("click", () => { sol.innerHTML = ""; sol.append(cur.solution()); });
    function make() {
      sol.innerHTML = ""; inp.value = ""; verdict.textContent = "";
      if (kind === "pr") {
        const algo = ["FIFO", "OPT", "LRU", "LFU"][rnd(0, 3)], n = rnd(3, 4), len = rnd(12, 16);
        const ref = Array.from({ length: len }, () => rnd(0, 6));
        const r = OS.pageReplace(ref, n, algo);
        q.innerHTML = `<b>${algo}</b> ใช้ <b>${n} เฟรม</b> กับ reference string <code>${ref.join(" ")}</code><br>เกิด page fault กี่ครั้ง?`;
        cur = { check: v => parseInt(v, 10) === r.faults, solution: () => { const h = el("div", { "data-ref": ref.join(" "), "data-frames": n, "data-algo": algo }); W.pr(h); h.querySelector(".wh select").remove(); h.querySelectorAll("button").forEach(b => { if (b.textContent === "แสดงทั้งหมด") b.click(); }); return el("div", null, el("p", { class: "ok" }, `ตอบ ${r.faults} ครั้ง (rate = ${r.faults}/${r.n} = ${(100 * r.rate).toFixed(1)}%)`), h); } };
      } else if (kind === "disk") {
        const algo = ["FCFS", "SSTF", "SCAN", "C-SCAN", "LOOK", "C-LOOK"][rnd(0, 5)], head = rnd(30, 150);
        const queue = Array.from({ length: rnd(6, 8) }, () => rnd(0, 199));
        const r = OS.disk(queue, head, 199, "down", algo);
        q.innerHTML = `ดิสก์ 0–199, หัวอ่านอยู่ที่ <b>${head}</b> และกำลังไปทาง 0, คิว <code>${queue.join(", ")}</code><br>ใช้ <b>${algo}</b> total head movement เท่าไร?`;
        cur = { check: v => parseInt(v, 10) === r.total, solution: () => el("div", { class: "explain", html: `ลำดับ ${r.path.join(" → ")}<br>= ${r.terms.map(t => t.dist).join(" + ")} = <b>${r.total}</b>` }) };
      } else if (kind === "paging") {
        const size = [4, 8, 16, 100, 1024][rnd(0, 4)], pages = rnd(4, 6);
        const table = Array.from({ length: pages }, () => rnd(0, 15));
        const la = rnd(0, size * pages - 1), r = OS.paging.translate(la, size, table);
        q.innerHTML = `page size = <b>${size}</b>, page table: ${table.map((f, p) => `${p}→${f}`).join(", ")}<br>logical address <b>${la}</b> = physical address เท่าไร?`;
        cur = { check: v => parseInt(v, 10) === r.physical, solution: () => el("div", { class: "explain", html: `p = ${la} div ${size} = ${r.p}, d = ${la} mod ${size} = ${r.d}<br>f = table[${r.p}] = ${r.f}<br>physical = ${r.f} × ${size} + ${r.d} = <b>${r.physical}</b>` }) };
      } else {
        let alloc, max, avail, r;
        do {
          alloc = Array.from({ length: 4 }, () => Array.from({ length: 3 }, () => rnd(0, 3)));
          max = alloc.map(row => row.map(v => v + rnd(0, 4)));
          avail = Array.from({ length: 3 }, () => rnd(0, 3));
          r = OS.banker.safety(alloc, max, avail);
        } while (Math.random() < 0.3 && !r.ok);
        const tbl = (M) => M.map((row, i) => `P${i + 1}: ${row.join(" ")}`).join("<br>");
        q.innerHTML = `<div class="grid3"><div><b>Allocation</b><br><span class="mono">${tbl(alloc)}</span></div><div><b>Max</b><br><span class="mono">${tbl(max)}</span></div><div><b>Available</b><br><span class="mono">${avail.join(" ")}</span></div></div>ระบบ safe ไหม? ถ้า safe ให้ตอบ safe sequence (เช่น P2 P4 P1 P3) ถ้าไม่ safe พิมพ์ <code>unsafe</code>`;
        cur = {
          check: v => {
            if (/unsafe/i.test(v)) return !r.ok;
            const seq = (v.match(/\d+/g) || []).map(x => +x - 1);
            if (!r.ok || seq.length !== 4 || new Set(seq).size !== 4) return false;
            let work = avail.slice();
            for (const i of seq) { if (!(i >= 0 && i < 4) || !OS.vec.le(OS.vec.sub(max[i], alloc[i]), work)) return false; work = OS.vec.add(work, alloc[i]); }
            return true;
          },
          solution: () => { return el("div", { class: "explain", html: (r.ok ? `safe ✓ เช่น &lt;${r.seq.map(i => "P" + (i + 1)).join(", ")}&gt;` : "unsafe ✗") + "<br>Need = " + r.need.map((n, i) => `P${i + 1}(${n.join(",")})`).join(" ") }); }
        };
      }
    }
    make();
  };

  W.mountAll = function () {
    document.querySelectorAll("[data-widget]").forEach(h => {
      const f = W[h.dataset.widget];
      if (!f) return;
      try { f(h); } catch (e) { h.textContent = "widget error: " + e.message; console.error(e); }
    });
  };
})();
