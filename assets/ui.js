/* ส่วน UI ที่ใช้ร่วมกันทุกหน้า: เมนู, สารบัญ, กรอบสไลด์, ปุ่มเล่นคลิป, lightbox, แบบทดสอบ */
(function () {
  "use strict";

  const PAGES = [
    ["index.html", "หน้าแรก"],
    ["basics.html", "0 ปูพื้นฐาน"],
    ["deadlock.html", "1 Deadlock"],
    ["memory.html", "2 Memory"],
    ["vm.html", "3 Virtual Memory ★"],
    ["storage.html", "4 Storage"],
    ["file.html", "5 File & Protection"],
    ["exam.html", "ข้อสอบจำลอง"],
  ];
  const SLIDE_DIR = "../สไลที่หามา แต่ไม่แน่ใจว่าออกสไลไหนบ้าง/";
  const VIDEO = "../คริปแนวอาจารย์/OSหัวข้อสอบ-16OCT2026.mp4";
  // offset = เลขหน้าที่พิมพ์ในชีท − เลขหน้า PDF
  const SOURCES = {
    dl: { name: "process_deadlock(2_4)", file: null, offset: 50, total: 18 },
    mem: { name: "memory_mng(3_1)", file: "memory_mng(3_1) (1).pdf", offset: 69, total: 12 },
    vm: { name: "virtaul_memory(3_2)", file: "virtaul_memory(3_2) (7).pdf", offset: 84, total: 7 },
    disk: { name: "secondary_storage_mng3_3", file: "secondary_storage_mng3_3.pdf", offset: 94, total: 10 },
    file: { name: "file and protection(4_1)", file: "file and protection(4_1).pdf", offset: 105, total: 12 },
    ch8: { name: "ch8-main-memory (สไลด์อังกฤษ)", file: "ch8-main-memory (1).pdf", offset: null, total: 57, slide: "8." },
    ch9: { name: "ch9-virtual_memories (สไลด์อังกฤษ)", file: "ch9-virtual_memories (2).pdf", offset: null, total: 71, slide: "9." },
    clip: { name: "คลิปอาจารย์ (วาดใน Paint)", file: null },
    hw: { name: "การบ้านใน Classroom (Sep 18, due Sep 24)", file: null },
    hwans: { name: "คำตอบการบ้านที่ส่งไป (ไฟล์ในโฟลเดอร์ ass)", file: null },
    hw2: { name: "การบ้านใน Classroom (Jul 24, due Aug 1)", file: null },
    hw2ans: { name: "งานที่ส่งไป (ไฟล์ในโฟลเดอร์ ass)", file: null },
  };

  const VERSION = "27 ต.ค. 2026 · v2";
  const UI = {};
  window.UI = UI;
  // เปิดจากไฟล์ในเครื่อง/วง LAN = มีคลิปและ PDF ให้ใช้, เปิดจากเว็บสาธารณะ = ไม่มี (ไม่ได้อัปโหลด)
  const LOCAL = !new URLSearchParams(location.search).has("hosted") &&
    (location.protocol === "file:" || /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname));
  UI.LOCAL = LOCAL;
  const pageKey = (location.pathname.split("/").pop() || "index.html").replace(".html", "");

  UI.el = function (tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    }
    kids.flat().forEach(c => { if (c !== null && c !== undefined) e.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return e;
  };
  UI.nums = s => String(s).split(/[\s,;]+/).filter(Boolean).map(Number).filter(x => !Number.isNaN(x));
  UI.fmtT = t => Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0");
  UI.store = {
    get(k, d) { try { const v = localStorage.getItem("osfinal:" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("osfinal:" + k, JSON.stringify(v)); } catch (e) { /* file:// บางเบราว์เซอร์ไม่ให้ใช้ */ } }
  };

  /* ---------- top bar ---------- */
  function topbar() {
    const cur = location.pathname.split("/").pop() || "index.html";
    const nav = UI.el("nav", null, PAGES.map(([href, label]) =>
      UI.el("a", { href, class: href === cur ? "on" : null, html: label.replace("★", '<span class="star">★</span>') })));
    const bar = UI.el("div", { class: "topbar" }, UI.el("div", { class: "in" },
      UI.el("a", { class: "brand", href: "index.html" }, "OS Final"), nav, UI.el("span", { class: "ver", title: "ถ้าวันที่นี้เก่า ให้กดรีเฟรช" }, "อัปเดต " + VERSION)));
    document.body.prepend(bar);
  }

  /* ---------- TOC ---------- */
  function toc() {
    const host = document.querySelector(".toc");
    const main = document.querySelector("main");
    if (!host || !main) return;
    host.append(UI.el("b", null, "ในหน้านี้"));
    let n = 0;
    main.querySelectorAll("h2, h3").forEach(h => {
      if (!h.id) h.id = "s" + (++n);
      host.append(UI.el("a", { href: "#" + h.id, class: h.tagName === "H3" ? "sub" : null }, h.textContent.replace(/[★]/g, "").trim()));
    });
    const links = [...host.querySelectorAll("a")];
    const heads = links.map(a => document.getElementById(a.getAttribute("href").slice(1)));
    const onScroll = () => {
      let k = 0;
      heads.forEach((h, i) => { if (h.getBoundingClientRect().top < 120) k = i; });
      links.forEach((a, i) => a.classList.toggle("on", i === k));
    };
    document.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- slides ---------- */
  // <figure class="slide" data-src="vm" data-page="4" data-img="vm-p04.jpg" data-fig="รูปที่ 3.2.E" data-t="1300" data-note="...">
  function slides() {
    document.querySelectorAll("figure.slide").forEach(fig => {
      const d = fig.dataset, src = SOURCES[d.src] || {};
      const img = UI.el("img", { src: "assets/slides/" + d.img, alt: (d.fig || src.name || ""), loading: "lazy" });
      const cap = UI.el("figcaption");
      const page = d.page ? parseInt(d.page, 10) : null;
      let where = "";
      if (src.offset !== null && src.offset !== undefined && page) where = `หน้า ${page + src.offset} ในชีท (PDF หน้า ${page}/${src.total})`;
      else if (src.slide && page) where = `สไลด์ ${src.slide}${page} (PDF หน้า ${page}/${src.total})`;
      cap.innerHTML = `📄 <b>${src.name || ""}</b>${where ? " · " + where : ""}${d.fig ? " · <b>" + d.fig + "</b>" : ""}`;
      if (d.note) cap.append(UI.el("div", { html: d.note }));
      const links = UI.el("div");
      if (LOCAL && src.file && page) links.append(UI.el("a", { href: encodeURI(SLIDE_DIR + src.file) + "#page=" + page, target: "_blank" }, "เปิด PDF หน้านี้ ↗"));
      if (d.src === "dl") links.append(UI.el("span", { class: "muted" }, "ไม่มีไฟล์ PDF ในเครื่อง — ภาพจับจากคลิป "));
      if (d.t) links.append(" ", tsButton(+d.t));
      if (links.childNodes.length) cap.append(links);
      img.addEventListener("click", () => openLightbox(img.src, cap.innerHTML));
      fig.prepend(img);
      fig.append(cap);
    });
  }

  /* ---------- lightbox ---------- */
  let lb;
  function openLightbox(src, capHtml) {
    if (!lb) {
      lb = UI.el("div", { class: "lightbox", onclick: e => { if (e.target === lb || e.target.classList.contains("x")) lb.classList.remove("on"); } },
        UI.el("button", { class: "x", title: "ปิด (Esc)" }, "✕"), UI.el("img"), UI.el("div", { class: "cap" }));
      document.body.append(lb);
      document.addEventListener("keydown", e => { if (e.key === "Escape") lb.classList.remove("on"); });
    }
    lb.querySelector("img").src = src;
    lb.querySelector(".cap").innerHTML = capHtml;
    lb.classList.add("on");
    lb.scrollTop = 0;
  }

  /* ---------- video ---------- */
  let dock, video;
  function ensureDock() {
    if (dock) return;
    video = UI.el("video", { controls: "", preload: "none", src: encodeURI(VIDEO) });
    dock = UI.el("div", { class: "vdock" }, video, UI.el("div", { class: "bar" },
      UI.el("span", null, "🎬 คลิปอาจารย์ 16 ต.ค. 2026"),
      UI.el("button", { title: "ปิด", onclick: () => { video.pause(); dock.classList.remove("on"); vbtn.style.display = ""; } }, "✕")));
    document.body.append(dock);
  }
  let vbtn;
  function videoButton() {
    if (!LOCAL) return;
    vbtn = UI.el("button", { class: "vbtn", onclick: () => { ensureDock(); dock.classList.add("on"); vbtn.style.display = "none"; } }, "🎬 เปิดคลิปอาจารย์");
    document.body.append(vbtn);
  }
  UI.play = function (t) {
    ensureDock();
    dock.classList.add("on"); vbtn.style.display = "none";
    const go = () => { video.currentTime = t; video.play().catch(() => {}); };
    if (video.readyState >= 1) go(); else { video.preload = "auto"; video.addEventListener("loadedmetadata", go, { once: true }); video.load(); }
  };
  function tsButton(t) {
    if (!LOCAL) return UI.el("span", { class: "ts off", title: "คลิปอาจารย์นาทีนี้ (ดูได้เมื่อเปิดเว็บจากคอมพิวเตอร์)" }, "🎬 " + UI.fmtT(t));
    return UI.el("button", { class: "ts", title: "ฟังอาจารย์พูดช่วงนี้", onclick: () => UI.play(t) }, "▶ " + UI.fmtT(t));
  }
  UI.tsButton = tsButton;
  function timestamps() {
    document.querySelectorAll("[data-ts]").forEach(e => {
      const t = +e.dataset.ts;
      e.replaceWith(tsButton(t));
    });
  }

  /* ---------- quiz ---------- */
  // <div class="q" data-type="mcq|num|text|open" data-answer="..."> ... </div>
  function quizzes() {
    const solved = UI.store.get("solved:" + pageKey, {});
    let idx = 0;
    document.querySelectorAll(".q").forEach(q => {
      const id = q.dataset.id || ("q" + (++idx));
      const type = q.dataset.type || "open";
      const fb = q.querySelector(".fb") || q.appendChild(UI.el("div", { class: "fb" }));
      const ans = q.querySelector(".ans");
      const mark = ok => {
        if (ok) { q.classList.add("solved"); solved[id] = 1; UI.store.set("solved:" + pageKey, solved); updateProgress(); }
      };
      if (solved[id]) q.classList.add("solved");
      if (type === "mcq") {
        const right = parseInt(q.dataset.answer, 10);
        q.querySelectorAll(".opt").forEach((b, k) => {
          b.addEventListener("click", () => {
            const ok = k === right;
            b.classList.add(ok ? "right" : "wrong");
            if (ok) q.querySelectorAll(".opt")[right].classList.add("right");
            fb.classList.add("on");
            fb.querySelector(".verdict")?.remove();
            fb.prepend(UI.el("div", { class: "verdict " + (ok ? "ok" : "no") }, ok ? "✓ ถูกต้อง" : "✗ ยังไม่ถูก ลองอีกครั้ง หรืออ่านคำอธิบาย"));
            mark(ok);
          });
        });
      } else if (type === "num" || type === "text") {
        const accept = q.dataset.answer.split("|").map(s => norm(s, type));
        const inp = UI.el("input", { type: "text", placeholder: type === "num" ? "ตอบเป็นตัวเลข" : "พิมพ์คำตอบ", style: "min-width:200px" });
        const btn = UI.el("button", { class: "b pri" }, "ตรวจ");
        const show = UI.el("button", { class: "b" }, "ดูเฉลย");
        const out = UI.el("span");
        const check = () => {
          const ok = accept.includes(norm(inp.value, type));
          out.className = ok ? "ok" : "no";
          out.textContent = ok ? " ✓ ถูกต้อง" : " ✗ ยังไม่ถูก";
          if (ok) { fb.classList.add("on"); if (ans) ans.classList.add("on"); }
          mark(ok);
        };
        btn.addEventListener("click", check);
        inp.addEventListener("keydown", e => { if (e.key === "Enter") check(); });
        show.addEventListener("click", () => { fb.classList.add("on"); if (ans) ans.classList.add("on"); });
        q.insertBefore(UI.el("div", { class: "row" }, inp, btn, show, out), ans || fb);
      } else {
        const show = UI.el("button", { class: "b" }, "ดูเฉลย");
        const good = UI.el("button", { class: "b", style: "display:none" }, "✓ ฉันตอบได้");
        show.addEventListener("click", () => { if (ans) ans.classList.add("on"); fb.classList.add("on"); good.style.display = ""; });
        good.addEventListener("click", () => mark(true));
        q.insertBefore(UI.el("div", { class: "row" }, show, good), ans || fb);
      }
    });
    updateProgress();
  }
  // num: เหลือแค่ตัวเลข/จุด/ลบ (พิมพ์ "17 ครั้ง" หรือ "140 ns" ก็ถูก) — text: ตัดช่องว่างและวงเล็บ
  function norm(s, type) {
    s = String(s).toLowerCase().trim();
    if (type === "num") return s.replace(/[^0-9.\-]/g, "").replace(/\.0+$/, "");
    return s.replace(/[\s,<>()\[\]{}'"`]+/g, "");
  }
  function updateProgress() {
    const total = document.querySelectorAll(".q").length;
    const done = document.querySelectorAll(".q.solved").length;
    if (total) UI.store.set("count:" + pageKey, { done, total });
    document.querySelectorAll("[data-progress]").forEach(e => {
      const c = UI.store.get("count:" + e.dataset.progress, { done: 0, total: 0 });
      const bar = e.querySelector("i"), txt = e.parentElement.querySelector(".ptxt");
      if (bar) bar.style.width = c.total ? (100 * c.done / c.total) + "%" : "0";
      if (txt) txt.textContent = c.total ? `ทำได้ ${c.done}/${c.total} ข้อ` : "ยังไม่ได้เริ่ม";
    });
  }
  UI.updateProgress = updateProgress;

  /* ---------- checklist (บันทึกสถานะ) ---------- */
  function checklists() {
    document.querySelectorAll(".check input[type=checkbox]").forEach((c, k) => {
      const key = "check:" + pageKey + ":" + (c.id || k);
      c.checked = UI.store.get(key, false);
      c.addEventListener("change", () => UI.store.set(key, c.checked));
    });
  }

  /* ---------- reveal blocks ---------- */
  function reveals() {
    document.querySelectorAll("details.sol").forEach(d => {
      if (!d.querySelector("summary")) d.prepend(UI.el("summary", null, "ดูเฉลย / วิธีทำ"));
    });
  }

  // ของที่มีเฉพาะในเครื่อง (เช่นภาพการบ้านที่มีชื่อ/รหัสนักศึกษา) ไม่แสดงบนเว็บสาธารณะ
  function localOnly() {
    document.querySelectorAll(LOCAL ? ".hosted-only" : ".local-only").forEach(e => e.remove());
    if (!LOCAL && pageKey === "index") {
      const main = document.querySelector("main");
      if (main) main.prepend(UI.el("div", { class: "box trap", html: '<span class="t">🌐 เวอร์ชันออนไลน์</span>เวอร์ชันนี้ไม่มีคลิปเสียงอาจารย์และไฟล์ PDF จึงบอกเวลาในคลิปเป็นตัวหนังสือแทน (🎬 17:02) ถ้าอยากฟังเสียงหรือเปิด PDF ให้เปิด <code>web/index.html</code> จากคอมพิวเตอร์' }));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    localOnly();
    topbar();
    slides();
    timestamps();
    quizzes();
    checklists();
    reveals();
    videoButton();
    toc();
    if (window.Widgets) window.Widgets.mountAll();
  });
})();
