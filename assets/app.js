/* KU창업클럽 AC 업무 안내: content/ 폴더의 마크다운·JSON을 읽어 화면을 그린다. */
(function () {
  "use strict";

  var data = { settings: null, forms: [], logos: [], steps: [], costs: [], home: "", faq: "", contact: "" };
  var CHECK_KEY = "ku-ac-checks-v1";
  var PICK_KEY = "ku-ac-picked-v1";
  var view = document.getElementById("view");

  var ICON_DL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';

  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 저장 불가 환경 */ }
  }
  var checks = load(CHECK_KEY, {});

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  function fetchText(path) {
    return fetch(encodeURI(path), { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path + " (" + r.status + ")");
      return r.text();
    });
  }

  // --- front matter / sections -------------------------------------------
  function parseDoc(src) {
    src = src.replace(/\r\n/g, "\n");
    var meta = {}, body = src;
    var m = src.match(/^---\n([\s\S]*?)\n---\n?/);
    if (m) {
      m[1].split("\n").forEach(function (line) {
        var i = line.indexOf(":");
        if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      });
      body = src.slice(m[0].length);
    }
    return { meta: meta, body: body };
  }

  function sections(body) {
    var out = [], parts = body.split(/^## +(.+)$/m);
    for (var i = 1; i < parts.length; i += 2) out.push({ title: parts[i].trim(), md: parts[i + 1] || "" });
    return out;
  }

  function listOf(v) {
    return (v || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }

  // --- rendering ----------------------------------------------------------
  function formById(id) {
    for (var i = 0; i < data.forms.length; i++) if (data.forms[i].id === id) return data.forms[i];
    return null;
  }
  function costBySlug(slug) {
    for (var i = 0; i < data.costs.length; i++) if (data.costs[i].slug === slug) return data.costs[i];
    return null;
  }

  function formChip(id) {
    var f = formById(id);
    if (!f) return '<span class="tbd">양식 ' + esc(id) + ' 없음</span>';
    var label = f.code + (/-(서식|약식)$/.test(id) ? " " + id.split("-")[1] : (f.code.indexOf(id) < 0 ? " " + id : ""));
    return '<a class="form-chip" href="forms/' + encodeURIComponent(f.file) + '" download title="' + esc(f.name) + ' 내려받기">' +
      ICON_DL + esc(label) + "</a>";
  }

  function interpolate(md) {
    return md
      .replace(/\{\{양식:([^}]+)\}\}/g, function (_, id) { return formChip(id.trim()); })
      .replace(/\{\{비용:([^}]+)\}\}/g, function (_, slug) {
        var c = costBySlug(slug.trim());
        return c ? '<a class="cost-link" href="#cost-' + c.slug + '">' + esc(c.meta.title) + " 안내</a>" : slug;
      })
      .replace(/\{\{(\w+)\}\}/g, function (all, key) {
        var v = data.settings && data.settings[key];
        return typeof v === "string" ? v : all;
      });
  }

  function tbd(html) {
    return html.replace(/\[확인 필요\]/g, '<span class="tbd">확인 필요</span>');
  }

  // 마크다운 → DOM. srcId는 체크 상태 저장 키의 앞부분.
  function renderMd(md, srcId) {
    var el = document.createElement("div");
    el.className = "md";
    el.innerHTML = tbd(window.marked.parse(interpolate(md), { gfm: true }));
    el.querySelectorAll("table").forEach(function (t) {
      var w = document.createElement("div"); w.className = "table-wrap";
      t.parentNode.insertBefore(w, t); w.appendChild(t);
    });
    el.querySelectorAll('a[href^="http"]').forEach(function (a) { a.target = "_blank"; a.rel = "noopener"; });
    el.querySelectorAll('li > input[type="checkbox"]').forEach(function (box) {
      var li = box.parentNode;
      var text = li.textContent.trim();
      var key = (srcId || "page") + "|" + text;
      var label = document.createElement("label");
      var span = document.createElement("span");
      while (box.nextSibling) span.appendChild(box.nextSibling);
      box.disabled = false;
      box.removeAttribute("disabled");
      box.checked = !!checks[key];
      box.dataset.key = key;
      label.appendChild(box); label.appendChild(span);
      li.appendChild(label);
      li.classList.add("task");
      if (li.parentNode) li.parentNode.classList.add("tasks");
    });
    return el;
  }

  view.addEventListener("change", function (e) {
    var box = e.target;
    if (!box.dataset || !box.dataset.key) return;
    if (box.checked) checks[box.dataset.key] = 1; else delete checks[box.dataset.key];
    save(CHECK_KEY, checks);
    document.querySelectorAll('input[data-key]').forEach(function (b) {
      if (b !== box && b.dataset.key === box.dataset.key) b.checked = box.checked;
    });
    updateProgress();
  });

  function h(tag, cls, html) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    return el;
  }

  function header(eyebrow, title, lede) {
    var f = document.createDocumentFragment();
    if (eyebrow) f.appendChild(h("p", "eyebrow", esc(eyebrow)));
    f.appendChild(h("h1", "page-title", esc(title)));
    if (lede) f.appendChild(h("p", "lede", tbd(esc(lede))));
    return f;
  }

  function chipRow(ids) {
    var row = h("div", "chip-row");
    row.innerHTML = ids.map(formChip).join("");
    return row;
  }

  // --- views ----------------------------------------------------------------
  function viewHome() {
    var s = data.settings;
    var hero = h("section", "hero");
    hero.innerHTML = '<p class="eyebrow">KU창업클럽 학생창업액셀러레이터</p>' +
      "<h1>AC 업무 안내</h1>" +
      "<p>지원 항목, 제출 양식과 시기, 빠뜨리면 안 되는 증빙을 한곳에 정리했다.<br>" + esc(s.orgName) + "</p>";
    view.appendChild(hero);

    var now = h("div", "now");
    now.innerHTML =
      '<a href="#step-1"><small>행사 전</small><b>협의, 계획서, 대관</b></a>' +
      '<a href="#step-4"><small>행사 당일</small><b>서명, 사진, 만족도</b></a>' +
      '<a href="#step-5"><small>행사 후</small><b>지출 증빙, 결과보고</b></a>';
    view.appendChild(now);

    view.appendChild(renderMd(data.home, "home"));

    view.appendChild(h("h2", "section-h", "업무 흐름"));
    var ol = h("ol", "flow");
    data.steps.forEach(function (st, i) {
      var li = h("li");
      li.innerHTML = '<span class="num">' + (i + 1) + "</span>" +
        '<div><a class="step-link" href="#step-' + (i + 1) + '"><span class="when">' + tbd(esc(st.meta.when || "")) + "</span>" +
        "<h3>" + esc(st.meta.title) + "</h3><p>" + tbd(esc(st.meta.summary || "")) + "</p></a></div>";
      var forms = listOf(st.meta.forms);
      if (forms.length) li.lastChild.appendChild(chipRow(forms));
      ol.appendChild(li);
    });
    view.appendChild(ol);

    view.appendChild(h("h2", "section-h", "비용 항목"));
    view.appendChild(costCards());
  }

  function viewSteps(target) {
    view.appendChild(header("단계별 안내", "6단계 업무 흐름", "단계마다 할 일, 제출 양식, 체크리스트 순서로 정리했다."));
    var idx = h("nav", "step-index");
    idx.setAttribute("aria-label", "단계 바로가기");
    idx.innerHTML = data.steps.map(function (st, i) {
      return '<a href="#step-' + (i + 1) + '">' + (i + 1) + ". " + esc(st.meta.title) + "</a>";
    }).join("");
    view.appendChild(idx);

    data.steps.forEach(function (st, i) {
      var sec = h("section", "step");
      sec.id = "step-" + (i + 1);
      var head = h("div", "step-head");
      head.innerHTML = '<span class="step-no">' + (i + 1) + "</span><h2>" + esc(st.meta.title) + "</h2>" +
        '<span class="step-meta">' + tbd(esc(st.meta.when || "")) + "</span>";
      sec.appendChild(head);
      sec.appendChild(h("p", "step-summary", tbd(esc(st.meta.summary || ""))));
      var forms = listOf(st.meta.forms);
      if (forms.length) sec.appendChild(chipRow(forms));
      var body = renderMd(st.body, "step-" + (i + 1));
      body.style.marginTop = "18px";
      sec.appendChild(body);
      view.appendChild(sec);
    });

    if (target) {
      var el = document.getElementById(target);
      if (el) requestAnimationFrame(function () { el.scrollIntoView(); });
    }
  }

  function costCards() {
    var grid = h("div", "cards");
    data.costs.forEach(function (c) {
      var a = h("a", "card");
      a.href = "#cost-" + c.slug;
      a.innerHTML = "<h3>" + esc(c.meta.title) + "</h3><p>" + esc(c.meta.summary || "") + "</p>" +
        '<span class="limit">' + tbd(esc(c.meta.limit || "")) + "</span>";
      grid.appendChild(a);
    });
    return grid;
  }

  function viewCosts() {
    view.appendChild(header("비용 항목별 안내", "무엇을 얼마까지 지원받나", "항목마다 지원 기준, 필요 증빙, 자주 하는 실수를 정리했다. 금액은 " + data.settings.manual + " 기준."));
    view.appendChild(costCards());
  }

  function viewCost(slug) {
    var c = costBySlug(slug);
    if (!c) return viewNotFound();
    view.appendChild(h("a", "back", "← 비용 항목 전체")).href = "#costs";
    view.appendChild(header("비용 항목", c.meta.title, c.meta.summary));
    var key = h("div", "keyfig");
    key.innerHTML = "<span>핵심 기준</span><b>" + tbd(esc(c.meta.limit || "")) + "</b>";
    view.appendChild(key);
    var forms = listOf(c.meta.forms);
    if (forms.length) { var row = chipRow(forms); row.style.margin = "0 0 22px"; view.appendChild(row); }
    view.appendChild(renderMd(c.body, "cost-" + c.slug));
  }

  function checklistOf(doc) {
    var secs = sections(doc.body);
    for (var i = 0; i < secs.length; i++) if (secs[i].title === "체크리스트") return secs[i].md;
    return "";
  }

  function viewChecklist() {
    view.appendChild(header("증빙 체크리스트", "제출 전 점검", "이번 행사에 쓴 비용 항목을 고르면 필요한 점검 항목만 모아 보여준다. 체크 상태는 이 기기의 브라우저에만 저장된다."));

    var picked = load(PICK_KEY, ["snack"]);
    var picker = h("div", "picker");
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", "사용한 비용 항목");
    data.costs.forEach(function (c) {
      var b = h("button", "pick", esc(c.meta.title));
      b.type = "button";
      b.id = "pick-" + c.slug;
      b.setAttribute("aria-pressed", picked.indexOf(c.slug) >= 0 ? "true" : "false");
      b.addEventListener("click", function () {
        var i = picked.indexOf(c.slug);
        if (i >= 0) picked.splice(i, 1); else picked.push(c.slug);
        save(PICK_KEY, picked);
        render();
      });
      picker.appendChild(b);
    });
    view.appendChild(picker);

    var prog = h("div", "progress");
    prog.innerHTML = '<span id="prog-text"></span><span class="bar"><i id="prog-bar"></i></span>';
    view.appendChild(prog);

    function group(title, items) {
      var g = h("section", "group");
      g.appendChild(h("h2", null, esc(title)));
      items.forEach(function (it) {
        if (!it.md.trim()) return;
        g.appendChild(h("h3", null, '<a href="' + it.href + '">' + esc(it.title) + "</a>"));
        g.appendChild(renderMd(it.md, it.id));
      });
      return g;
    }
    function stepItem(n) {
      var st = data.steps[n - 1];
      return { title: n + ". " + st.meta.title, md: checklistOf(st), id: "step-" + n, href: "#step-" + n };
    }

    view.appendChild(group("행사 전", [stepItem(1), stepItem(2), stepItem(3)]));
    view.appendChild(group("행사 당일", [stepItem(4)]));
    var costItems = [stepItem(5)].concat(data.costs.filter(function (c) { return picked.indexOf(c.slug) >= 0; }).map(function (c) {
      return { title: c.meta.title, md: checklistOf(c), id: "cost-" + c.slug, href: "#cost-" + c.slug };
    }));
    view.appendChild(group("지출 증빙", costItems));
    view.appendChild(group("결과보고", [stepItem(6)]));

    var reset = h("div", "reset-row");
    var btn = h("button", "btn", "체크 전체 해제");
    btn.type = "button";
    btn.id = "reset-checks";
    btn.addEventListener("click", function () {
      if (btn.dataset.armed) {
        checks = {}; save(CHECK_KEY, checks); render();
      } else {
        btn.dataset.armed = "1"; btn.classList.add("danger"); btn.textContent = "한 번 더 누르면 해제";
      }
    });
    reset.appendChild(btn);
    reset.appendChild(h("span", null, "다음 행사를 준비할 때 사용"));
    view.appendChild(reset);
    updateProgress();
  }

  function updateProgress() {
    var t = document.getElementById("prog-text"), bar = document.getElementById("prog-bar");
    if (!t) return;
    var boxes = view.querySelectorAll("input[data-key]");
    var done = 0;
    boxes.forEach(function (b) { if (b.checked) done++; });
    t.textContent = done + " / " + boxes.length + " 완료";
    bar.style.width = boxes.length ? (done / boxes.length * 100) + "%" : "0";
  }

  // 여러 파일을 브라우저에서 zip으로 묶어 내려받는다.
  function zipButton(label, zipName, files, id) {
    var wrap = h("div", "zip-row");
    var btn = h("button", "dl", ICON_DL + esc(label));
    btn.type = "button"; btn.id = id;
    var note = h("span", "zip-note");
    note.setAttribute("aria-live", "polite");
    btn.addEventListener("click", function () {
      if (!window.JSZip) { note.textContent = "압축 기능을 불러오지 못했다. 파일을 하나씩 내려받는다."; return; }
      btn.disabled = true; note.textContent = "묶는 중 (0/" + files.length + ")";
      var zip = new window.JSZip(), done = 0;
      Promise.all(files.map(function (f) {
        return fetch(encodeURI(f.path)).then(function (r) {
          if (!r.ok) throw new Error(f.name);
          return r.blob();
        }).then(function (b) { zip.file(f.name, b); done++; note.textContent = "묶는 중 (" + done + "/" + files.length + ")"; });
      })).then(function () {
        return zip.generateAsync({ type: "blob" });
      }).then(function (blob) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = zipName;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
        note.textContent = "내려받기를 시작했다.";
      }).catch(function (e) {
        note.textContent = "파일을 찾지 못했다: " + e.message;
      }).then(function () { btn.disabled = false; });
    });
    wrap.appendChild(btn); wrap.appendChild(note);
    return wrap;
  }

  function viewForms() {
    view.appendChild(header("양식 모음", "양식 1~11 내려받기", "모두 한글(hwpx) 파일이다. 증빙 양식은 내려받은 파일에 그대로 작성해 한글 원본으로 제출한다."));
    view.appendChild(zipButton("양식 전체 zip", "KU창업클럽-AC-양식-전체.zip",
      data.forms.map(function (f) { return { name: f.file, path: "forms/" + f.file }; }), "zip-forms"));
    var byStep = {};
    data.forms.forEach(function (f) { (byStep[f.step] = byStep[f.step] || []).push(f); });
    Object.keys(byStep).sort().forEach(function (n) {
      var g = h("section", "forms-group");
      var st = data.steps[n - 1];
      g.appendChild(h("h2", null, '<a href="#step-' + n + '">' + n + ". " + esc(st ? st.meta.title : "") + "</a>"));
      byStep[n].forEach(function (f) {
        var row = h("div", "form-row");
        var variant = /-(서식|약식)$/.test(f.id) ? " " + f.id.split("-")[1] : (f.code.indexOf(f.id) < 0 ? " " + f.id : "");
        row.innerHTML = '<span class="code">' + esc(f.code + variant) + "</span>" +
          "<div><b>" + esc(f.name) + '</b><span class="when">' + tbd(esc(f.when)) + "</span></div>" +
          '<a class="dl" href="forms/' + encodeURIComponent(f.file) + '" download>' + ICON_DL + "hwpx</a>";
        g.appendChild(row);
      });
      view.appendChild(g);
    });

    if (data.logos.length) {
      var lg = h("section", "logos");
      lg.id = "logos";
      lg.appendChild(h("h2", "section-h", "로고"));
      lg.appendChild(h("p", "lede", "계획서, 결과보고서, 홍보물에 쓰는 로고 파일."));
      lg.appendChild(zipButton("로고 전체 zip", "KU창업클럽-AC-로고-전체.zip",
        data.logos.map(function (l) { return { name: l.file.split("/").pop(), path: l.file }; }), "zip-logos"));
      var grid = h("div", "logo-grid");
      data.logos.forEach(function (l) {
        var c = h("div", "logo-card");
        c.innerHTML = '<div class="logo-thumb"><img src="' + esc(l.file) + '" alt="' + esc(l.name) + '" loading="lazy"></div>' +
          "<b>" + esc(l.name) + '</b><span class="when">' + esc(l.desc) + " · " + esc(l.size) + "</span>" +
          '<a class="dl" href="' + esc(l.file) + '" download>' + ICON_DL + "PNG</a>";
        grid.appendChild(c);
      });
      lg.appendChild(grid);
      view.appendChild(lg);
    }
  }

  function viewFaq() {
    view.appendChild(header("FAQ", "자주 묻는 질문", null));
    var input = h("input", "search");
    input.type = "search"; input.id = "faq-search"; input.placeholder = "질문 검색 (예: 영수증, 서명, 심사)";
    input.setAttribute("aria-label", "질문 검색");
    view.appendChild(input);
    var items = sections(data.faq).map(function (s, i) {
      var d = h("details", "qa");
      d.id = "faq-" + (i + 1);
      d.appendChild(h("summary", null, tbd(esc(s.title))));
      d.appendChild(renderMd(s.md, "faq"));
      view.appendChild(d);
      return { el: d, text: (s.title + " " + s.md).toLowerCase() };
    });
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      items.forEach(function (it) {
        var hit = !q || it.text.indexOf(q) >= 0;
        it.el.hidden = !hit;
        if (q && hit) it.el.open = true;
      });
    });
  }

  function viewContact() {
    var s = data.settings;
    view.appendChild(header("문의", s.orgName, null));
    var card = h("section", "contact-card");
    card.innerHTML = "<h2>" + esc(s.orgName) + "</h2>" +
      contactLine("메일", s.email, "mailto:" + s.email) +
      contactLine("전화", s.phone, "tel:" + s.phone.replace(/-/g, ""));
    view.appendChild(card);
    card.querySelectorAll("button[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.dataset.copy, note = b.nextElementSibling;
        var done = function () { note.textContent = "복사됨"; };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(v).then(done, function () { selectText(b.previousElementSibling); note.textContent = "선택됨. 직접 복사"; });
        } else { selectText(b.previousElementSibling); note.textContent = "선택됨. 직접 복사"; }
      });
    });
    view.appendChild(renderMd(data.contact, "contact"));
  }
  function contactLine(label, value, href) {
    return '<div class="contact-line"><span>' + label + '</span><b><a href="' + esc(href) + '">' + esc(value) + "</a></b>" +
      '<button class="btn" type="button" data-copy="' + esc(value) + '">복사</button><em class="copied" aria-live="polite"></em></div>';
  }
  function selectText(el) {
    try { var r = document.createRange(); r.selectNodeContents(el); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch (e) {}
  }

  function viewNotFound() {
    view.appendChild(header(null, "페이지를 찾을 수 없다", null));
    view.appendChild(h("p", null, '<a href="#home">홈으로</a>'));
  }

  // --- router -----------------------------------------------------------------
  var lastRoute = null;
  function render() {
    var route = decodeURIComponent(location.hash.replace(/^#/, "")) || "home";
    var section = route.indexOf("step-") === 0 ? "steps" : route.indexOf("cost-") === 0 ? "costs" : route;
    var keepScroll = route === lastRoute;
    var y = window.scrollY;
    view.innerHTML = "";
    if (route === "home") viewHome();
    else if (route === "steps") viewSteps();
    else if (route.indexOf("step-") === 0) viewSteps(route);
    else if (route === "costs") viewCosts();
    else if (route.indexOf("cost-") === 0) viewCost(route.slice(5));
    else if (route === "checklist") viewChecklist();
    else if (route === "forms") viewForms();
    else if (route === "faq") viewFaq();
    else if (route === "contact") viewContact();
    else viewNotFound();
    document.querySelectorAll("[data-nav]").forEach(function (a) {
      var on = a.dataset.nav === section;
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (keepScroll) window.scrollTo(0, y);
    else if (route.indexOf("step-") !== 0) window.scrollTo(0, 0);
    lastRoute = route;
  }

  function footer() {
    var s = data.settings;
    document.getElementById("foot-contact").innerHTML =
      "<b>" + esc(s.orgName) + "</b><span>" + esc(s.email) + "</span><span>" + esc(s.phone) + "</span>";
    document.getElementById("foot-note").textContent =
      "사업 관리번호 " + s.projectCode + " (" + s.projectYear + ") · 기준 자료: " + s.manual + ", 창업지원센터 양식 · 내용 기준일 " + s.updated;
  }

  // --- boot -------------------------------------------------------------------
  function boot() {
    if (!window.marked) {
      view.innerHTML = '<p class="error">화면 구성 스크립트를 불러오지 못했다. 인터넷 연결을 확인한 뒤 새로고침한다.</p>';
      return;
    }
    fetchText("content/settings.json").then(function (t) {
      data.settings = JSON.parse(t);
      var s = data.settings;
      return Promise.all([
        fetchText("content/forms.json").then(function (t) { data.forms = JSON.parse(t); }),
        fetchText("content/logos.json").then(function (t) { data.logos = JSON.parse(t); }, function () { data.logos = []; }),
        Promise.all(s.steps.map(function (f) { return fetchText("content/steps/" + f).then(parseDoc); })).then(function (d) { data.steps = d; }),
        Promise.all(s.costs.map(function (f) {
          return fetchText("content/costs/" + f).then(function (t) { var d = parseDoc(t); d.slug = f.replace(/\.md$/, ""); return d; });
        })).then(function (d) { data.costs = d; }),
        fetchText("content/home.md").then(function (t) { data.home = t; }),
        fetchText("content/faq.md").then(function (t) { data.faq = t.replace(/\r\n/g, "\n"); }),
        fetchText("content/contact.md").then(function (t) { data.contact = t; })
      ]);
    }).then(function () {
      document.title = data.settings.siteName;
      footer();
      render();
      window.addEventListener("hashchange", render);
    }).catch(function (err) {
      view.innerHTML = '<p class="error">내용 파일을 읽지 못했다: ' + esc(err.message) +
        "<br>파일을 더블클릭해 열면 이 오류가 난다. 배포 주소나 로컬 서버로 열어야 한다.</p>";
    });
  }
  boot();
})();
