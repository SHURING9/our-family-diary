import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/*
  1) 아래 두 값을 Supabase 프로젝트에서 확인한 값으로 바꿔 주세요.
  Project URL: Project Settings > API
  Publishable key: Project Settings > API Keys
  service_role / secret 키는 절대 여기에 넣지 마세요.
*/
const SUPABASE_URL = "https://asloixxmwxrivupfarip.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ph7nw4VMizEhnd-mu8l1JQ_JptWDuA7";

const configured = SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_") &&
  SUPABASE_PUBLISHABLE_KEY &&
  !SUPABASE_PUBLISHABLE_KEY.includes("YOUR_");

const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

const $ = (id) => document.getElementById(id);
const views = ["auth-view", "family-setup-view", "app-view"];
const kinds = {
  all: { title: "오늘의 가족 보드", add: "기록 추가하기" },
  event: { title: "가족 일정", add: "일정 추가하기" },
  task: { title: "할 일과 집안일", add: "할 일 추가하기" },
  shopping: { title: "장보기 목록", add: "물건 추가하기" },
  childcare: { title: "소중한 육아 기록", add: "기록 남기기" },
  meal: { title: "이번 주 식단 계획", add: "식단 추가하기" }
};
const categoryOptions = {
  event: [["family","가족 약속"],["school","학교·어린이집"],["appointment","병원·예약"],["birthday","기념일"],["other","기타"]],
  task: [["home","집안일"],["family","가족 공통"],["shopping","장보기"],["other","기타"]],
  shopping: [["food","식료품"],["household","생활용품"],["child","아이 용품"],["other","기타"]],
  childcare: [["daily","일상"],["health","건강"],["growth","성장·발달"],["memory","추억"],["other","기타"]],
  meal: [["breakfast","아침"],["lunch","점심"],["dinner","저녁"],["snack","간식"],["prep","식단 준비"]]
};
let authMode = "login";
let currentUser = null;
let currentFamily = null;
let currentKind = "all";
let currentTargetFilter = "all";
let items = [];
let busy = false;

function showView(id) {
  views.forEach(view => $(view).classList.toggle("hidden", view !== id));
}
function message(id, text = "", error = false) {
  const el = $(id);
  el.textContent = text;
  el.style.color = error ? "#b15f50" : "";
}
function setBusy(value) {
  busy = value;
  document.querySelectorAll("button").forEach(button => {
    if (!button.dataset.keepEnabled) button.disabled = value;
  });
}
function localDate(date = new Date()) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
}
function prettyDate(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(date);
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}
function categoryLabel(kind, category) {
  const found = (categoryOptions[kind] || []).find(([value]) => value === category);
  return found ? found[1] : "";
}
function kindLabel(kind) {
  return ({event:"가족 일정", task:"할 일", shopping:"장보기", childcare:"육아 기록", meal:"식단"})[kind] || "기록";
}
const targetOptions = [
  ["family", "가족"],
  ["woong", "웅"],
  ["ddu", "뚜"],
  ["soyul", "소율"],
  ["siyul", "시율"]
];
function targetLabel(target) {
  return targetOptions.find(([value]) => value === target)?.[1] || "가족";
}
function setupTargetOptions() {
  const select = $("item-target");
  select.innerHTML = "";
  targetOptions.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
  select.value = "family";
}
function updateTargetFilter() {
  document.querySelectorAll("[data-target-filter]").forEach(button => {
    button.classList.toggle("active", button.dataset.targetFilter === currentTargetFilter);
  });
  renderItems();
}
function updateAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll("[data-auth-mode]").forEach(btn => btn.classList.toggle("active", btn.dataset.authMode === mode));
  $("auth-submit").textContent = mode === "login" ? "로그인하기" : "가입하고 시작하기";
  $("auth-password").autocomplete = mode === "login" ? "current-password" : "new-password";
  message("auth-message", "");
}
function setupCategoryOptions(kind) {
  const select = $("item-category");
  select.innerHTML = '<option value="">선택해 주세요</option>';
  (categoryOptions[kind] || []).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
}
function openAddForm() {
  if (!currentFamily) return;
  const kind = currentKind === "all" ? "event" : currentKind;
  $("item-form").dataset.kind = kind;
  $("form-title").textContent = kinds[kind].add;
  $("item-title").value = "";
  $("item-details").value = "";
  $("item-date").value = localDate();
  $("item-quantity").value = "";
  setupCategoryOptions(kind);
  setupTargetOptions();
  $("date-field").classList.toggle("hidden", kind === "childcare");
  $("category-field").classList.toggle("hidden", kind === "childcare");
  $("quantity-field").classList.toggle("hidden", kind !== "shopping");
  $("add-form-wrap").classList.remove("hidden");
  message("item-message", "");
  $("item-title").focus();
}
function closeAddForm() {
  $("add-form-wrap").classList.add("hidden");
  $("item-form").reset();
}
function setCurrentKind(kind) {
  currentKind = kind;
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.kind === kind));
  $("list-title").textContent = kinds[kind].title;
  $("add-button-label").textContent = kinds[kind].add;
  renderItems();
}
function updateSummary() {
  $("count-events").textContent = items.filter(x => x.kind === "event" && !x.completed).length;
  $("count-tasks").textContent = items.filter(x => x.kind === "task" && !x.completed).length;
  $("count-shopping").textContent = items.filter(x => x.kind === "shopping" && !x.completed).length;
  $("count-childcare").textContent = items.filter(x => x.kind === "childcare").length;
}
function renderItems() {
  const list = $("items-list");
  const filtered = items.filter(item => (currentKind === "all" || item.kind === currentKind) &&
      (currentTargetFilter === "all" || (item.target || "family") === currentTargetFilter))
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return b.created_at.localeCompare(a.created_at);
    });
  $("loading-state").classList.add("hidden");
  $("empty-state").classList.toggle("hidden", filtered.length !== 0);
  list.innerHTML = "";
  filtered.forEach(item => {
    const card = document.createElement("article");
    card.className = "item-card";
    const canCheck = ["task", "shopping"].includes(item.kind);
    card.innerHTML = `
      ${canCheck ? `<button class="item-check ${item.completed ? "checked" : ""}" aria-label="${item.completed ? "완료 취소" : "완료 처리"}" data-toggle="${item.id}">${item.completed ? "✓" : ""}</button>` : `<span class="summary-icon">${({event:"📅",childcare:"🌱",meal:"🍲"})[item.kind] || "♡"}</span>`}
      <div class="item-main">
        <div class="item-topline">
          <div class="item-title ${item.completed ? "completed" : ""}">${escapeHTML(item.title)}</div>
          <button class="delete-btn" data-delete="${item.id}" aria-label="기록 삭제">×</button>
        </div>
        ${item.date ? `<div class="item-date">${escapeHTML(prettyDate(item.date))}</div>` : ""}
        ${item.details ? `<p class="item-details">${escapeHTML(item.details)}</p>` : ""}
        <div class="item-meta">
          <span class="pill">${escapeHTML(kindLabel(item.kind))}</span>
          <span class="pill target-pill">${escapeHTML(targetLabel(item.target || "family"))}</span>
          ${item.category ? `<span class="pill">${escapeHTML(categoryLabel(item.kind, item.category) || item.category)}</span>` : ""}
          ${item.quantity ? `<span class="pill">${escapeHTML(item.quantity)}</span>` : ""}
          ${item.completed ? `<span class="pill">완료</span>` : ""}
        </div>
      </div>`;
    list.appendChild(card);
  });
  updateSummary();
}
async function loadFamily() {
  if (!supabase || !currentUser) return;
  message("global-message", "");
  const { data: membership, error: memberError } = await supabase
    .from("family_members").select("family_id").eq("user_id", currentUser.id).limit(1).maybeSingle();
  if (memberError) throw memberError;
  if (!membership) {
    currentFamily = null;
    showView("family-setup-view");
    return;
  }
  const { data: family, error: familyError } = await supabase
    .from("families").select("id,name,invite_code").eq("id", membership.family_id).single();
  if (familyError) throw familyError;
  currentFamily = family;
  $("family-name-display").textContent = family.name;
  $("family-invite-code").textContent = family.invite_code;
  $("today-label").textContent = new Intl.DateTimeFormat("ko-KR", {year:"numeric", month:"long", day:"numeric", weekday:"long"}).format(new Date()) + " · 오늘의 일상을 차곡차곡 모아봐요.";
  showView("app-view");
  $("loading-state").classList.remove("hidden");
  const { data, error } = await supabase.from("family_items").select("*").eq("family_id", family.id).order("created_at", {ascending:false});
  if (error) throw error;
  items = data || [];
  renderItems();
}
async function refreshAuthState(session) {
  currentUser = session?.user || null;
  $("user-area").classList.toggle("hidden", !currentUser);
  $("user-email").textContent = currentUser?.email || "";
  if (!currentUser) {
    currentFamily = null; items = [];
    showView("auth-view");
    return;
  }
  try { await loadFamily(); }
  catch (error) {
    console.error(error);
    message("global-message", "정보를 불러오지 못했어요. Supabase 설정과 데이터베이스 SQL 적용 여부를 확인해 주세요. (" + error.message + ")", true);
  }
}
async function addItem(event) {
  event.preventDefault();
  if (!currentFamily) return;
  const kind = $("item-form").dataset.kind;
  const title = $("item-title").value.trim();
  if (!title) return;
  setBusy(true);
  const payload = {
    family_id: currentFamily.id, created_by: currentUser.id, kind, title,
    details: $("item-details").value.trim() || null,
    date: kind === "childcare" ? null : ($("item-date").value || null),
    category: $("item-category").value || null,
    target: $("item-target").value || "family",
    quantity: kind === "shopping" ? ($("item-quantity").value.trim() || null) : null,
    completed: false
  };
  const { error } = await supabase.from("family_items").insert(payload);
  setBusy(false);
  if (error) { message("item-message", "저장하지 못했어요: " + error.message, true); return; }
  closeAddForm();
  await loadFamily();
}
async function toggleItem(id) {
  const item = items.find(x => x.id === id);
  if (!item) return;
  const { error } = await supabase.from("family_items").update({completed: !item.completed}).eq("id", id);
  if (error) { message("global-message", "상태를 바꾸지 못했어요: " + error.message, true); return; }
  await loadFamily();
}
async function deleteItem(id) {
  const item = items.find(x => x.id === id);
  if (!item || !confirm(`"${item.title}" 기록을 삭제할까요?`)) return;
  const { error } = await supabase.from("family_items").delete().eq("id", id);
  if (error) { message("global-message", "삭제하지 못했어요: " + error.message, true); return; }
  await loadFamily();
}
async function createFamily(event) {
  event.preventDefault();
  if (!supabase) return;
  const name = $("family-name").value.trim();
  if (!name) return;
  setBusy(true);
  const { error } = await supabase.rpc("create_family", {p_name:name});
  setBusy(false);
  if (error) { message("setup-message", "가족 공간을 만들지 못했어요: " + error.message, true); return; }
  await loadFamily();
}
async function joinFamily(event) {
  event.preventDefault();
  if (!supabase) return;
  const code = $("invite-code").value.trim().toUpperCase();
  setBusy(true);
  const { error } = await supabase.rpc("join_family", {p_invite_code:code});
  setBusy(false);
  if (error) { message("setup-message", "참여하지 못했어요. 초대 코드를 확인해 주세요. (" + error.message + ")", true); return; }
  await loadFamily();
}
async function copyInvite() {
  const code = $("family-invite-code").textContent;
  try {
    await navigator.clipboard.writeText(code);
    message("global-message", "초대 코드를 복사했어요. 가족에게 직접 전달해 주세요.");
  } catch {
    message("global-message", "초대 코드: " + code + " (코드를 길게 눌러 복사해 주세요)");
  }
}
function bindEvents() {
  document.querySelectorAll("[data-auth-mode]").forEach(btn => btn.addEventListener("click", () => updateAuthMode(btn.dataset.authMode)));
  $("auth-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!supabase) return;
    message("auth-message", "");
    setBusy(true);
    const email = $("auth-email").value.trim();
    const password = $("auth-password").value;
    const result = authMode === "login"
      ? await supabase.auth.signInWithPassword({email, password})
      : await supabase.auth.signUp({email, password});
    setBusy(false);
    if (result.error) { message("auth-message", result.error.message, true); return; }
    if (authMode === "signup" && !result.data.session) {
      message("auth-message", "가입 확인 이메일을 보냈어요. 이메일 인증을 마친 뒤 로그인해 주세요.");
      return;
    }
    if (result.data.session) await refreshAuthState(result.data.session);
  });
  $("logout-btn").addEventListener("click", async () => { await supabase.auth.signOut(); });
  $("create-family-form").addEventListener("submit", createFamily);
  $("join-family-form").addEventListener("submit", joinFamily);
  document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => setCurrentKind(btn.dataset.kind)));
  document.querySelectorAll("[data-target-filter]").forEach(btn => btn.addEventListener("click", () => { currentTargetFilter = btn.dataset.targetFilter; updateTargetFilter(); }));
  $("add-item-btn").addEventListener("click", openAddForm);
  $("empty-add-btn").addEventListener("click", openAddForm);
  $("cancel-add-btn").addEventListener("click", closeAddForm);
  $("cancel-add-btn-bottom").addEventListener("click", closeAddForm);
  $("item-form").addEventListener("submit", addItem);
  $("items-list").addEventListener("click", async event => {
    const toggle = event.target.closest("[data-toggle]");
    const remove = event.target.closest("[data-delete]");
    if (toggle) await toggleItem(toggle.dataset.toggle);
    if (remove) await deleteItem(remove.dataset.delete);
  });
  $("copy-invite-btn").addEventListener("click", copyInvite);
}

bindEvents();
if (!configured) {
  showView("auth-view");
  message("auth-message", "시작하려면 app.js 파일에서 Supabase URL과 Publishable key를 먼저 입력해 주세요.");
} else {
  supabase.auth.getSession().then(({data}) => refreshAuthState(data.session));
  supabase.auth.onAuthStateChange((_event, session) => {
    refreshAuthState(session);
  });
}
