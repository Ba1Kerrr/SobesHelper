import React, { useEffect, useState } from "react";
import { useError } from "../contexts/ErrorContext";
import ErrorDisplay from "../components/ErrorDisplay";
import SuperJobPanel from "./SuperJobPanel";
import ExternalLinkPanel from "./ExternalLinkPanel";
import FlRuPanel from "./FlRuPanel";
import KanbanBoard from "./KanbanBoard";

interface Option {
  id: string;
  name: string;
}

interface Resume {
  id: string;
  title?: string;
  updated_at?: string;
}

interface Negotiation {
  id: string;
  state: string;
  vacancy_id: string;
  employer_id: string;
  created_at: string;
  vacancy_name: string | null;
  vacancy_url: string | null;
  employer_name: string | null;
}

interface AuthStatus {
  authorized: boolean;
  user: { first_name?: string; last_name?: string } | null;
  auth_running?: boolean;
  reason?: string;
}

interface ProgressEntry {
  message: string;
}

interface AutomationStatus {
  enabled?: boolean;
  intervalHours?: number;
  presetName?: string;
  nextRunAt?: number;
  lastRunAt?: number;
  lastStatus?: string;
}

interface Statistics {
  by_state?: Record<string, number>;
  skipped_by_reason?: Record<string, number>;
  daily_negotiations?: Record<string, number>;
  daily_skipped?: Record<string, number>;
  total_negotiations?: number;
  total_skipped?: number;
}

const EMPLOYMENT_OPTIONS = [
  { value: "full", label: "Full-time" },
  { value: "part", label: "Part-time" },
  { value: "project", label: "Project" },
  { value: "volunteer", label: "Volunteer" },
  { value: "probation", label: "Internship" },
];

type JobsTab = "search" | "responses" | "resumes" | "stats";
type Platform = "hh" | "superjob" | "habr" | "linkedin" | "flru" | "kanban";

const PLATFORMS: Array<{ id: Platform; label: string }> = [
  { id: "hh", label: "hh.ru" },
  { id: "superjob", label: "SuperJob" },
  { id: "habr", label: "Хабр Карьера" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "flru", label: "FL.ru" },
  { id: "kanban", label: "📋 Kanban" },
];

const buildHabrUrl = (query: string, location: string) => {
  const params = new URLSearchParams({ type: "all" });
  if (query) params.set("q", query);
  const url = `https://career.habr.com/vacancies?${params.toString()}`;
  return location ? `${url}&location=${encodeURIComponent(location)}` : url;
};

const buildLinkedInUrl = (query: string, location: string) => {
  const params = new URLSearchParams();
  if (query) params.set("keywords", query);
  if (location) params.set("location", location);
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
};

const call = (method: string, params?: Record<string, any>) => window.electronAPI.callHHTool(method, params);

const JobsPage: React.FC = () => {
  const { error, setError, clearError } = useError();
  const [platform, setPlatform] = useState<Platform>("hh");
  const [tab, setTab] = useState<JobsTab>("search");

  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  const [areas, setAreas] = useState<Option[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [industries, setIndustries] = useState<Option[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);

  const [search, setSearch] = useState("");
  const [areaId, setAreaId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [industryId, setIndustryId] = useState("");
  const [experience, setExperience] = useState("");
  const [schedule, setSchedule] = useState("");
  const [salary, setSalary] = useState("");
  const [onlyWithSalary, setOnlyWithSalary] = useState(false);
  const [resumeId, setResumeId] = useState("");
  const [totalPages, setTotalPages] = useState("2");
  const [dryRun, setDryRun] = useState(true);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [orderBy, setOrderBy] = useState("");
  const [employment, setEmployment] = useState<string[]>([]);
  const [currency, setCurrency] = useState("");
  const [period, setPeriod] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [excludedFilter, setExcludedFilter] = useState("");
  const [forceMessage, setForceMessage] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [skipTests, setSkipTests] = useState(false);
  const [maxResponses, setMaxResponses] = useState("");
  const [perPage, setPerPage] = useState("");
  const [label, setLabel] = useState("");
  const [metro, setMetro] = useState("");
  const [employerId, setEmployerId] = useState("");
  const [excludedEmployerId, setExcludedEmployerId] = useState("");
  const [searchField, setSearchField] = useState("");
  const [noMagic, setNoMagic] = useState(false);
  const [premium, setPremium] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const [aiFilter, setAiFilter] = useState<"" | "light" | "heavy">("");
  const [aiRateLimit, setAiRateLimit] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [messagePrompt, setMessagePrompt] = useState("");
  const [aiLetterConfigured, setAiLetterConfigured] = useState(false);
  const [topLat, setTopLat] = useState("");
  const [bottomLat, setBottomLat] = useState("");
  const [leftLng, setLeftLng] = useState("");
  const [rightLng, setRightLng] = useState("");
  const [sortPointLat, setSortPointLat] = useState("");
  const [sortPointLng, setSortPointLng] = useState("");
  const [letterFile, setLetterFile] = useState("");

  const [refreshingResumes, setRefreshingResumes] = useState(false);
  const [cloningResumeId, setCloningResumeId] = useState<string | null>(null);
  const [resumeTemplatePath, setResumeTemplatePath] = useState("");
  const [resumeDryRun, setResumeDryRun] = useState(true);
  const [resumePublish, setResumePublish] = useState(false);
  const [creatingResume, setCreatingResume] = useState(false);

  const [searchAutoEnabled, setSearchAutoEnabled] = useState(false);
  const [searchAutoPreset, setSearchAutoPreset] = useState("");
  const [searchAutoInterval, setSearchAutoInterval] = useState("6");
  const [searchAutoStatus, setSearchAutoStatus] = useState<AutomationStatus>({});
  const [savingSearchAuto, setSavingSearchAuto] = useState(false);
  const [resumeAutoEnabled, setResumeAutoEnabled] = useState(false);
  const [resumeAutoInterval, setResumeAutoInterval] = useState("4");
  const [resumeAutoStatus, setResumeAutoStatus] = useState<AutomationStatus>({});
  const [savingResumeAuto, setSavingResumeAuto] = useState(false);

  const [replyMessage, setReplyMessage] = useState("");
  const [replyUseAi, setReplyUseAi] = useState(false);
  const [replyOnlyInvitations, setReplyOnlyInvitations] = useState(false);
  const [replyPeriod, setReplyPeriod] = useState("");
  const [replyDryRun, setReplyDryRun] = useState(true);
  const [replying, setReplying] = useState(false);

  const [clearOlderThan, setClearOlderThan] = useState("");
  const [clearBlacklistDiscard, setClearBlacklistDiscard] = useState(false);
  const [clearDeleteChat, setClearDeleteChat] = useState(false);
  const [clearNegDryRun, setClearNegDryRun] = useState(true);
  const [clearingNegotiations, setClearingNegotiations] = useState(false);

  const [skippedReason, setSkippedReason] = useState("");
  const [clearSkippedDryRun, setClearSkippedDryRun] = useState(true);
  const [clearingSkipped, setClearingSkipped] = useState(false);

  const [refreshingToken, setRefreshingToken] = useState(false);
  const [testingSession, setTestingSession] = useState(false);

  const [presetName, setPresetName] = useState("");
  const [presetList, setPresetList] = useState<string[]>([]);
  const [presetBusy, setPresetBusy] = useState(false);

  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);

  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [refreshingNegotiations, setRefreshingNegotiations] = useState(false);
  const [activeVacancy, setActiveVacancy] = useState<{ vacancy_name: string } | null>(null);

  const [stats, setStats] = useState<Statistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);

  const refreshStatus = async () => {
    try {
      setStatus(await call("get_status"));
    } catch {
      setError("Failed to reach the Jobs backend. Check the Python path in Settings.");
    }
  };

  const refreshPresetList = async () => {
    try {
      setPresetList((await call("list_presets")) || []);
    } catch {
      // ignore - list just stays empty
    }
  };

  useEffect(() => {
    (async () => {
      await refreshStatus();
      try {
        const [areaList, roleList, industryList, resumeList, config] = await Promise.all([
          call("get_areas"),
          call("get_professional_roles"),
          call("get_industries"),
          call("get_resumes"),
          window.electronAPI.getConfig(),
        ]);
        setAreas(areaList || []);
        setRoles(roleList || []);
        setIndustries(industryList || []);
        setResumes(resumeList || []);
        if (config.active_vacancy) setActiveVacancy(config.active_vacancy);
      } catch {
        // Auth/network-dependent lookups - fine to leave empty until the user logs in.
      }
      try {
        setNegotiations((await call("get_negotiations_from_db")) || []);
      } catch {
        // ignore - table just stays empty
      }
      try {
        const hhConfig = await call("get_config");
        setAiLetterConfigured(!!hhConfig?.openai_cover_letter?.api_key);
      } catch {
        // ignore - warning just won't show
      }
      try {
        const automation = await window.electronAPI.ipcRenderer.invoke("get-job-automation-status");
        if (automation?.search) {
          setSearchAutoEnabled(!!automation.search.enabled);
          setSearchAutoPreset(automation.search.presetName || "");
          setSearchAutoInterval(String(automation.search.intervalHours || 6));
          setSearchAutoStatus(automation.search);
        }
        if (automation?.resumeRefresh) {
          setResumeAutoEnabled(!!automation.resumeRefresh.enabled);
          setResumeAutoInterval(String(automation.resumeRefresh.intervalHours || 4));
          setResumeAutoStatus(automation.resumeRefresh);
        }
      } catch {
        // ignore - automation sections just show defaults
      }
      await refreshPresetList();
    })();

    const onEvent = (_event: any, data: any) => {
      if (data?.type === "auth") {
        setAuthMessage(data.message || "");
        if (data.event === "done" || data.event === "error") {
          setAuthBusy(false);
          refreshStatus();
        }
      } else if (data?.type === "progress") {
        setProgress((prev) => [...prev.slice(-49), { message: data.message || "" }]);
      }
    };
    window.electronAPI.ipcRenderer.on("hh-event", onEvent);
    return () => window.electronAPI.ipcRenderer.removeListener("hh-event", onEvent);
  }, []);

  useEffect(() => {
    if (tab === "stats" && !statsLoaded) {
      setStatsLoading(true);
      call("get_statistics")
        .then((s) => {
          setStats(s || {});
          setStatsLoaded(true);
        })
        .catch(() => setError("Failed to load statistics."))
        .finally(() => setStatsLoading(false));
    }
  }, [tab, statsLoaded]);

  const handleLogin = async () => {
    setAuthBusy(true);
    setAuthMessage("Starting browser login...");
    try {
      const result = await call("start_login");
      if (result?.status === "error") {
        setAuthBusy(false);
        setError(result.message || "Failed to start login.");
      }
    } catch {
      setAuthBusy(false);
      setError("Failed to start login.");
    }
  };

  const handleLogout = async () => {
    try {
      await call("logout");
      await refreshStatus();
    } catch {
      setError("Failed to log out.");
    }
  };

  const toList = (value: string): string[] =>
    value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

  // Shared by "run search" and "save preset" - the exact set of fields
  // apply_vacancies understands, only included when actually set so an
  // unset field falls back to the operation's own default instead of an
  // explicit empty override.
  const buildParams = (): Record<string, any> => {
    const params: Record<string, any> = { dry_run: dryRun };
    if (search.trim()) params.search = search.trim();
    if (areaId) params.area = [areaId];
    if (roleId) params.professional_role = [roleId];
    if (industryId) params.industry = [industryId];
    if (experience) params.experience = experience;
    if (schedule) params.schedule = schedule;
    if (salary) params.salary = Number(salary);
    if (onlyWithSalary) params.only_with_salary = true;
    if (resumeId) params.resume_id = resumeId;
    if (totalPages) params.total_pages = Number(totalPages);
    if (orderBy) params.order_by = orderBy;
    if (employment.length) params.employment = employment;
    if (currency) params.currency = currency;
    if (period) params.period = Number(period);
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (excludedFilter.trim()) params.excluded_filter = excludedFilter.trim();
    if (forceMessage) params.force_message = true;
    if (sendEmail) params.send_email = true;
    if (skipTests) params.skip_tests = true;
    if (maxResponses) params.max_responses = Number(maxResponses);
    if (perPage) params.per_page = Number(perPage);
    if (label.trim()) params.label = toList(label);
    if (metro.trim()) params.metro = toList(metro);
    if (employerId.trim()) params.employer_id = toList(employerId);
    if (excludedEmployerId.trim()) params.excluded_employer_id = toList(excludedEmployerId);
    if (searchField.trim()) params.search_field = toList(searchField);
    if (noMagic) params.no_magic = true;
    if (premium) params.premium = true;
    if (useAi) params.use_ai = true;
    if (aiFilter) params.ai_filter = aiFilter;
    if (aiRateLimit) params.ai_rate_limit = Number(aiRateLimit);
    if (systemPrompt.trim()) params.system_prompt = systemPrompt.trim();
    if (messagePrompt.trim()) params.message_prompt = messagePrompt.trim();
    if (topLat) params.top_lat = Number(topLat);
    if (bottomLat) params.bottom_lat = Number(bottomLat);
    if (leftLng) params.left_lng = Number(leftLng);
    if (rightLng) params.right_lng = Number(rightLng);
    if (sortPointLat) params.sort_point_lat = Number(sortPointLat);
    if (sortPointLng) params.sort_point_lng = Number(sortPointLng);
    if (letterFile.trim()) params.letter_file = letterFile.trim();
    return params;
  };

  const hydrateFromParams = (params: Record<string, any>) => {
    setSearch(params.search || "");
    setAreaId(params.area?.[0] || "");
    setRoleId(params.professional_role?.[0] || "");
    setIndustryId(params.industry?.[0] || "");
    setExperience(params.experience || "");
    setSchedule(params.schedule || "");
    setSalary(params.salary != null ? String(params.salary) : "");
    setOnlyWithSalary(!!params.only_with_salary);
    setResumeId(params.resume_id || "");
    setTotalPages(params.total_pages != null ? String(params.total_pages) : "2");
    setDryRun(params.dry_run !== false);
    setOrderBy(params.order_by || "");
    setEmployment(params.employment || []);
    setCurrency(params.currency || "");
    setPeriod(params.period != null ? String(params.period) : "");
    setDateFrom(params.date_from || "");
    setDateTo(params.date_to || "");
    setExcludedFilter(params.excluded_filter || "");
    setForceMessage(!!params.force_message);
    setSendEmail(!!params.send_email);
    setSkipTests(!!params.skip_tests);
    setMaxResponses(params.max_responses != null ? String(params.max_responses) : "");
    setPerPage(params.per_page != null ? String(params.per_page) : "");
    setLabel((params.label || []).join(", "));
    setMetro((params.metro || []).join(", "));
    setEmployerId((params.employer_id || []).join(", "));
    setExcludedEmployerId((params.excluded_employer_id || []).join(", "));
    setSearchField((params.search_field || []).join(", "));
    setNoMagic(!!params.no_magic);
    setPremium(!!params.premium);
    setUseAi(!!params.use_ai);
    setAiFilter(params.ai_filter === "light" || params.ai_filter === "heavy" ? params.ai_filter : "");
    setAiRateLimit(params.ai_rate_limit != null ? String(params.ai_rate_limit) : "");
    setSystemPrompt(params.system_prompt || "");
    setMessagePrompt(params.message_prompt || "");
    setTopLat(params.top_lat != null ? String(params.top_lat) : "");
    setBottomLat(params.bottom_lat != null ? String(params.bottom_lat) : "");
    setLeftLng(params.left_lng != null ? String(params.left_lng) : "");
    setRightLng(params.right_lng != null ? String(params.right_lng) : "");
    setSortPointLat(params.sort_point_lat != null ? String(params.sort_point_lat) : "");
    setSortPointLng(params.sort_point_lng != null ? String(params.sort_point_lng) : "");
    setLetterFile(params.letter_file || "");
  };

  const handleApply = async () => {
    setApplying(true);
    setProgress([]);
    try {
      const result = await call("apply_vacancies", { params: buildParams() });
      if (result?.status === "error") {
        setError(result.message || "Search/apply run failed.");
      }
    } catch {
      setError("Search/apply run failed.");
    } finally {
      setApplying(false);
    }
  };

  const handleCancel = async () => {
    try {
      await call("cancel_apply");
    } catch {
      // best-effort
    }
  };

  const toggleEmployment = (value: string) => {
    setEmployment((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const handleSavePreset = async () => {
    const name = presetName.trim();
    if (!name) return;
    setPresetBusy(true);
    try {
      const result = await call("save_preset", { name, params: buildParams() });
      if (result?.status === "error") {
        setError(result.message || "Failed to save preset.");
      } else {
        setPresetName("");
        await refreshPresetList();
      }
    } catch {
      setError("Failed to save preset.");
    } finally {
      setPresetBusy(false);
    }
  };

  const handleLoadPreset = async (name: string) => {
    try {
      const params = await call("load_preset", { name });
      if (params) hydrateFromParams(params);
    } catch {
      setError("Failed to load preset.");
    }
  };

  const handleDeletePreset = async (name: string) => {
    try {
      await call("delete_preset", { name });
      await refreshPresetList();
    } catch {
      setError("Failed to delete preset.");
    }
  };

  const handleRefreshNegotiations = async () => {
    setRefreshingNegotiations(true);
    try {
      await call("refresh_negotiations", { status: "active" });
      setNegotiations((await call("get_negotiations_from_db")) || []);
    } catch {
      setError("Failed to refresh responses from hh.ru.");
    } finally {
      setRefreshingNegotiations(false);
    }
  };

  const useForInterview = async (n: Negotiation) => {
    const vacancy = {
      vacancy_name: n.vacancy_name || "Unknown vacancy",
      employer_name: n.employer_name || "Unknown employer",
      vacancy_url: n.vacancy_url || "",
    };
    const config = await window.electronAPI.getConfig();
    await window.electronAPI.setConfig({ ...config, active_vacancy: vacancy });
    setActiveVacancy(vacancy);
  };

  // Generic runner for every operation other than apply_vacancies (which
  // keeps its own dedicated apply_vacancies/cancel_apply methods) - covers
  // update_resumes, clone_resume, create_resume, reply_employers,
  // clear_negotiations, clear_skipped, refresh_token, test_session.
  const runOp = (name: string, params: Record<string, any> = {}) => call("run_operation", { name, params });

  const handleChooseLetterFile = async () => {
    const result = await window.electronAPI.chooseFile([{ name: "Text", extensions: ["txt", "md"] }]);
    if (!result.canceled && result.path) setLetterFile(result.path);
  };

  const handleChooseResumeTemplate = async () => {
    const result = await window.electronAPI.chooseFile([{ name: "Resume template", extensions: ["md", "toml"] }]);
    if (!result.canceled && result.path) setResumeTemplatePath(result.path);
  };

  const handleRefreshResumes = async () => {
    setRefreshingResumes(true);
    setProgress([]);
    try {
      const result = await runOp("update_resumes");
      if (result?.status === "error") setError(result.message || "Failed to refresh resumes.");
      setResumes((await call("get_resumes")) || []);
    } catch {
      setError("Failed to refresh resumes.");
    } finally {
      setRefreshingResumes(false);
    }
  };

  const handleCloneResume = async (id: string) => {
    if (!window.confirm("Clone this resume? This creates a real duplicate on your hh.ru account - there's no dry run for this one.")) {
      return;
    }
    setCloningResumeId(id);
    try {
      const result = await runOp("clone_resume", { resume_id: id });
      if (result?.status === "error") setError(result.message || "Failed to clone resume.");
      else setResumes((await call("get_resumes")) || []);
    } catch {
      setError("Failed to clone resume.");
    } finally {
      setCloningResumeId(null);
    }
  };

  const handleCreateResume = async () => {
    if (!resumeTemplatePath) return;
    setCreatingResume(true);
    setProgress([]);
    try {
      const result = await runOp("create_resume", {
        _positional: [resumeTemplatePath],
        dry_run: resumeDryRun,
        publish: resumePublish,
      });
      if (result?.status === "error") setError(result.message || "Failed to create resume.");
      else if (!resumeDryRun) setResumes((await call("get_resumes")) || []);
    } catch {
      setError("Failed to create resume.");
    } finally {
      setCreatingResume(false);
    }
  };

  const handleReplyEmployers = async () => {
    // reply_employers.py falls back to an interactive input() prompt when
    // neither is set - which would hang the bridge process forever, since
    // there's no terminal on the other end to type into.
    if (!replyMessage.trim() && !replyUseAi) {
      setError("Enter a reply message or enable AI replies first.");
      return;
    }
    setReplying(true);
    setProgress([]);
    try {
      const params: Record<string, any> = { dry_run: replyDryRun };
      if (replyMessage.trim()) params.reply_message = replyMessage.trim();
      if (replyUseAi) params.use_ai = true;
      if (replyOnlyInvitations) params.only_invitations = true;
      if (replyPeriod) params.period = Number(replyPeriod);
      const result = await runOp("reply_employers", params);
      if (result?.status === "error") setError(result.message || "Failed to reply to employers.");
    } catch {
      setError("Failed to reply to employers.");
    } finally {
      setReplying(false);
    }
  };

  const handleClearNegotiations = async () => {
    setClearingNegotiations(true);
    setProgress([]);
    try {
      const params: Record<string, any> = { dry_run: clearNegDryRun };
      if (clearOlderThan) params.older_than = Number(clearOlderThan);
      if (clearBlacklistDiscard) params.blacklist_discard = true;
      if (clearDeleteChat) params.delete_chat = true;
      const result = await runOp("clear_negotiations", params);
      if (result?.status === "error") setError(result.message || "Failed to clear responses.");
      else setNegotiations((await call("get_negotiations_from_db")) || []);
    } catch {
      setError("Failed to clear responses.");
    } finally {
      setClearingNegotiations(false);
    }
  };

  const handleClearSkipped = async () => {
    setClearingSkipped(true);
    setProgress([]);
    try {
      const params: Record<string, any> = { dry_run: clearSkippedDryRun };
      if (skippedReason) params.reason = skippedReason;
      const result = await runOp("clear_skipped", params);
      if (result?.status === "error") setError(result.message || "Failed to clear skipped vacancies.");
    } catch {
      setError("Failed to clear skipped vacancies.");
    } finally {
      setClearingSkipped(false);
    }
  };

  const handleRefreshToken = async () => {
    setRefreshingToken(true);
    try {
      const result = await runOp("refresh_token");
      if (result?.status === "error") setError(result.message || "Failed to refresh token.");
      else await refreshStatus();
    } catch {
      setError("Failed to refresh token.");
    } finally {
      setRefreshingToken(false);
    }
  };

  const handleTestSession = async () => {
    setTestingSession(true);
    setProgress([]);
    try {
      const result = await runOp("test_session");
      if (result?.status === "error") setError(result.message || "Failed to test session.");
    } catch {
      setError("Failed to test session.");
    } finally {
      setTestingSession(false);
    }
  };

  const handleSaveSearchAutomation = async (enabled: boolean) => {
    if (enabled && !searchAutoPreset) {
      setError("Pick a preset for search automation first.");
      return;
    }
    setSavingSearchAuto(true);
    try {
      const automation = await window.electronAPI.ipcRenderer.invoke("set-job-automation", {
        search: { enabled, presetName: searchAutoPreset, intervalHours: Number(searchAutoInterval) || 6 },
      });
      setSearchAutoEnabled(!!automation.search?.enabled);
      setSearchAutoStatus(automation.search || {});
    } catch {
      setError("Failed to save search automation settings.");
    } finally {
      setSavingSearchAuto(false);
    }
  };

  const handleSaveResumeAutomation = async (enabled: boolean) => {
    setSavingResumeAuto(true);
    try {
      const automation = await window.electronAPI.ipcRenderer.invoke("set-job-automation", {
        resumeRefresh: { enabled, intervalHours: Number(resumeAutoInterval) || 4 },
      });
      setResumeAutoEnabled(!!automation.resumeRefresh?.enabled);
      setResumeAutoStatus(automation.resumeRefresh || {});
    } catch {
      setError("Failed to save resume automation settings.");
    } finally {
      setSavingResumeAuto(false);
    }
  };

  const formatWhen = (ms?: number) => (ms ? new Date(ms).toLocaleString() : "-");

  const selectClass = "select select-bordered select-xs w-full bg-base-200";
  const inputClass = "input input-bordered input-xs w-full bg-base-200";

  const topEntries = (obj: Record<string, number> | undefined, n: number): Array<[string, number]> =>
    Object.entries(obj || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);

  return (
    <div className="flex flex-col h-full text-sm">
      <ErrorDisplay error={error} onClose={clearError} />

      <div className="tabs tabs-boxed tabs-xs mb-2 flex-wrap">
        {PLATFORMS.map((p) => (
          <a key={p.id} className={`tab ${platform === p.id ? "tab-active" : ""}`} onClick={() => setPlatform(p.id)}>
            {p.label}
          </a>
        ))}
      </div>

      {platform === "superjob" && (
        <div className="flex-1 overflow-y-auto">
          <SuperJobPanel />
        </div>
      )}
      {platform === "habr" && (
        <div className="flex-1 overflow-y-auto">
          <ExternalLinkPanel
            siteName="Хабр Карьера"
            note="Автоматизация запрещена условиями сервиса career.habr.com - открывает поиск в браузере, отклик только вручную."
            buildUrl={buildHabrUrl}
          />
        </div>
      )}
      {platform === "linkedin" && (
        <div className="flex-1 overflow-y-auto">
          <ExternalLinkPanel
            siteName="LinkedIn"
            note="LinkedIn запрещает автоматизацию/ботов в User Agreement - открывает поиск в браузере, отклик только вручную."
            buildUrl={buildLinkedInUrl}
          />
        </div>
      )}
      {platform === "flru" && (
        <div className="flex-1 overflow-y-auto">
          <FlRuPanel />
        </div>
      )}
      {platform === "kanban" && <KanbanBoard />}

      {platform === "hh" && (
      <>
      <div className="flex items-center justify-between mb-2 bg-base-200 rounded px-2 py-1.5">
        {status?.authorized ? (
          <>
            <span className="truncate">
              ✅ {status.user?.first_name} {status.user?.last_name}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={handleTestSession} disabled={testingSession} className="btn btn-ghost btn-xs" title="Verify the browser session is still valid">
                {testingSession ? "..." : "✓ Test session"}
              </button>
              <button onClick={handleRefreshToken} disabled={refreshingToken} className="btn btn-ghost btn-xs" title="Refresh access token if expired">
                {refreshingToken ? "..." : "🔁"}
              </button>
              <button onClick={handleLogout} className="btn btn-ghost btn-xs">
                Log out
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="opacity-70 truncate">{authBusy ? authMessage || "Signing in..." : "Not signed in to hh.ru"}</span>
            <button onClick={handleLogin} disabled={authBusy} className="btn btn-primary btn-xs">
              {authBusy ? "..." : "Sign in"}
            </button>
          </>
        )}
      </div>

      {activeVacancy && (
        <div className="mb-2 text-xs opacity-70 truncate">
          📌 Interview context: {activeVacancy.vacancy_name}
        </div>
      )}

      <div className="tabs tabs-boxed tabs-xs mb-2">
        <a className={`tab ${tab === "search" ? "tab-active" : ""}`} onClick={() => setTab("search")}>
          Search &amp; Apply
        </a>
        <a className={`tab ${tab === "responses" ? "tab-active" : ""}`} onClick={() => setTab("responses")}>
          Responses
        </a>
        <a className={`tab ${tab === "resumes" ? "tab-active" : ""}`} onClick={() => setTab("resumes")}>
          Resumes
        </a>
        <a className={`tab ${tab === "stats" ? "tab-active" : ""}`} onClick={() => setTab("stats")}>
          Stats
        </a>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "search" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <select
                className={`${selectClass} flex-1`}
                value=""
                onChange={(e) => e.target.value && handleLoadPreset(e.target.value)}
              >
                <option value="">Load preset...</option>
                {presetList.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <input
                className={`${inputClass} flex-1`}
                placeholder="New preset name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
              <button onClick={handleSavePreset} disabled={presetBusy || !presetName.trim()} className="btn btn-ghost btn-xs">
                💾
              </button>
            </div>
            {presetList.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {presetList.map((name) => (
                  <span key={name} className="badge badge-sm gap-1">
                    {name}
                    <button onClick={() => handleDeletePreset(name)} className="opacity-60 hover:opacity-100" title="Delete preset">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            <input
              className={inputClass}
              placeholder="Search query (e.g. Python developer)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <select className={selectClass} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                <option value="">Any area</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select className={selectClass} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">Any role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <select className={selectClass} value={experience} onChange={(e) => setExperience(e.target.value)}>
                <option value="">Any experience</option>
                <option value="noExperience">No experience</option>
                <option value="between1And3">1-3 years</option>
                <option value="between3And6">3-6 years</option>
                <option value="moreThan6">6+ years</option>
              </select>
              <select className={selectClass} value={schedule} onChange={(e) => setSchedule(e.target.value)}>
                <option value="">Any schedule</option>
                <option value="remote">Remote</option>
                <option value="fullDay">Full day</option>
                <option value="flexible">Flexible</option>
                <option value="shift">Shift</option>
              </select>
              <input
                className={inputClass}
                type="number"
                placeholder="Min salary"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
              />
              <select className={selectClass} value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
                <option value="">Default resume</option>
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title || r.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1">
                <input type="checkbox" className="checkbox checkbox-xs" checked={onlyWithSalary} onChange={(e) => setOnlyWithSalary(e.target.checked)} />
                Salary specified only
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" className="checkbox checkbox-xs" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                Dry run (don't actually apply)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-70">Search depth (pages):</span>
              <input
                className={`${inputClass} w-16`}
                type="number"
                min={1}
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value)}
              />
            </div>

            <button onClick={() => setAdvancedOpen((v) => !v)} className="text-xs opacity-70 hover:opacity-100">
              {advancedOpen ? "▾" : "▸"} Advanced filters
            </button>
            {advancedOpen && (
              <div className="space-y-2 bg-base-200 rounded p-2">
                <div className="grid grid-cols-2 gap-2">
                  <select className={selectClass} value={industryId} onChange={(e) => setIndustryId(e.target.value)}>
                    <option value="">Any industry</option>
                    {industries.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                  <select className={selectClass} value={orderBy} onChange={(e) => setOrderBy(e.target.value)}>
                    <option value="">Sort: relevance</option>
                    <option value="publication_time">Sort: newest</option>
                    <option value="salary_desc">Sort: salary (high-low)</option>
                    <option value="salary_asc">Sort: salary (low-high)</option>
                    <option value="distance">Sort: distance</option>
                  </select>
                  <select className={selectClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="">Any currency</option>
                    <option value="RUR">RUR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="Published within N days"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    type="date"
                    placeholder="From"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    type="date"
                    placeholder="To"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="Max responses on vacancy"
                    value={maxResponses}
                    onChange={(e) => setMaxResponses(e.target.value)}
                  />
                </div>
                <input
                  className={inputClass}
                  placeholder="Exclude regex (e.g. junior|стажир)"
                  value={excludedFilter}
                  onChange={(e) => setExcludedFilter(e.target.value)}
                />
                <div className="flex flex-wrap gap-2 text-xs">
                  {EMPLOYMENT_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={employment.includes(opt.value)}
                        onChange={() => toggleEmployment(opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" className="checkbox checkbox-xs" checked={forceMessage} onChange={(e) => setForceMessage(e.target.checked)} />
                    Always send cover message
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" className="checkbox checkbox-xs" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
                    Email employer too
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" className="checkbox checkbox-xs" checked={skipTests} onChange={(e) => setSkipTests(e.target.checked)} />
                    Skip vacancy tests
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" className="checkbox checkbox-xs" checked={noMagic} onChange={(e) => setNoMagic(e.target.checked)} />
                    Disable query auto-parsing
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" className="checkbox checkbox-xs" checked={premium} onChange={(e) => setPremium(e.target.checked)} />
                    Premium vacancies only
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="Results per page (default 100)"
                    value={perPage}
                    onChange={(e) => setPerPage(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Labels (comma-separated)"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Metro station IDs (comma-separated)"
                    value={metro}
                    onChange={(e) => setMetro(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Search fields (name, company_name...)"
                    value={searchField}
                    onChange={(e) => setSearchField(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Employer IDs (comma-separated)"
                    value={employerId}
                    onChange={(e) => setEmployerId(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Exclude employer IDs"
                    value={excludedEmployerId}
                    onChange={(e) => setExcludedEmployerId(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    placeholder="Cover letter file (.txt/.md)"
                    value={letterFile}
                    readOnly
                    onClick={handleChooseLetterFile}
                  />
                  <button onClick={handleChooseLetterFile} className="btn btn-ghost btn-xs flex-shrink-0">
                    Choose file...
                  </button>
                </div>

                <div className="border-t pt-2 mt-1" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                  <div className="text-xs opacity-60 mb-1">Geo filters</div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <input className={inputClass} type="number" placeholder="Top lat" value={topLat} onChange={(e) => setTopLat(e.target.value)} />
                    <input className={inputClass} type="number" placeholder="Bottom lat" value={bottomLat} onChange={(e) => setBottomLat(e.target.value)} />
                    <input className={inputClass} type="number" placeholder="Left lng" value={leftLng} onChange={(e) => setLeftLng(e.target.value)} />
                    <input className={inputClass} type="number" placeholder="Right lng" value={rightLng} onChange={(e) => setRightLng(e.target.value)} />
                    <input
                      className={inputClass}
                      type="number"
                      placeholder="Sort point lat"
                      value={sortPointLat}
                      onChange={(e) => setSortPointLat(e.target.value)}
                    />
                    <input
                      className={inputClass}
                      type="number"
                      placeholder="Sort point lng"
                      value={sortPointLng}
                      onChange={(e) => setSortPointLng(e.target.value)}
                    />
                  </div>
                </div>

                <div className="border-t pt-2 mt-1" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                  <div className="flex flex-wrap gap-3 text-xs mb-2">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" className="checkbox checkbox-xs" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
                      Use AI for cover letters
                    </label>
                    <select className={`${selectClass} w-auto`} value={aiFilter} onChange={(e) => setAiFilter(e.target.value as any)}>
                      <option value="">No AI filtering</option>
                      <option value="light">AI filter: light</option>
                      <option value="heavy">AI filter: heavy</option>
                    </select>
                  </div>
                  {(useAi || aiFilter) && !aiLetterConfigured && (
                    <p className="text-xs text-warning mb-2">
                      Configure an API key for this in Settings → "Jobs - AI Cover Letters", otherwise this will fail.
                    </p>
                  )}
                  {(useAi || aiFilter) && (
                    <div className="space-y-2">
                      <input
                        className={inputClass}
                        type="number"
                        placeholder="AI rate limit (requests/min, default 40)"
                        value={aiRateLimit}
                        onChange={(e) => setAiRateLimit(e.target.value)}
                      />
                      <textarea
                        className="textarea textarea-bordered textarea-xs w-full bg-base-200"
                        placeholder="Custom system prompt for cover letters (optional)"
                        rows={2}
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                      />
                      <textarea
                        className="textarea textarea-bordered textarea-xs w-full bg-base-200"
                        placeholder="Custom message prompt (optional)"
                        rows={2}
                        value={messagePrompt}
                        onChange={(e) => setMessagePrompt(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t pt-2 mt-1" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <div className="text-xs opacity-60 mb-1">🤖 Automation</div>
              <div className="flex items-center gap-2 mb-1">
                <select className={`${selectClass} flex-1`} value={searchAutoPreset} onChange={(e) => setSearchAutoPreset(e.target.value)}>
                  <option value="">Pick a preset...</option>
                  {presetList.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <input
                  className={`${inputClass} w-16`}
                  type="number"
                  min={1}
                  value={searchAutoInterval}
                  onChange={(e) => setSearchAutoInterval(e.target.value)}
                  title="Interval in hours"
                />
                <span className="text-xs opacity-60 flex-shrink-0">hrs</span>
              </div>
              <button
                onClick={() => handleSaveSearchAutomation(!searchAutoEnabled)}
                disabled={savingSearchAuto}
                className={`btn btn-xs w-full ${searchAutoEnabled ? "btn-error" : "btn-secondary"}`}
              >
                {savingSearchAuto ? "Saving..." : searchAutoEnabled ? "Disable automation" : "Enable automation"}
              </button>
              <p className="text-xs opacity-50 mt-1">
                {searchAutoEnabled
                  ? `Next run: ${formatWhen(searchAutoStatus.nextRunAt)} - Last: ${formatWhen(searchAutoStatus.lastRunAt)} (${searchAutoStatus.lastStatus || "-"})`
                  : "Runs the chosen preset on a schedule, using its own dry-run setting. Only while the app is open."}
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={handleApply} disabled={applying} className="btn btn-primary btn-xs flex-1">
                {applying ? "Running..." : dryRun ? "Preview matches" : "Search & Apply"}
              </button>
              {applying && (
                <button onClick={handleCancel} className="btn btn-ghost btn-xs">
                  Cancel
                </button>
              )}
            </div>
            {progress.length > 0 && (
              <div className="bg-base-200 rounded p-2 text-xs font-mono max-h-40 overflow-y-auto space-y-0.5">
                {progress.map((p, i) => (
                  <div key={i} className="opacity-80 truncate">
                    {p.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "responses" && (
          <div className="space-y-2">
            <button onClick={handleRefreshNegotiations} disabled={refreshingNegotiations} className="btn btn-ghost btn-xs">
              {refreshingNegotiations ? "Refreshing..." : "🔄 Refresh from hh.ru"}
            </button>
            {negotiations.length === 0 && <p className="text-xs opacity-50">No responses yet.</p>}
            {negotiations.map((n) => (
              <div key={n.id} className="bg-base-200 rounded p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{n.vacancy_name || n.vacancy_id}</span>
                  <span className="badge badge-xs">{n.state}</span>
                </div>
                <div className="text-xs opacity-60 truncate">{n.employer_name}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs opacity-50">{new Date(n.created_at).toLocaleDateString()}</span>
                  <button onClick={() => useForInterview(n)} className="btn btn-ghost btn-xs">
                    📌 Use for interview
                  </button>
                </div>
              </div>
            ))}

            <div className="border-t pt-2 mt-2" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <div className="text-xs opacity-60 mb-1">Reply to employers</div>
              <textarea
                className="textarea textarea-bordered textarea-xs w-full bg-base-200 mb-2"
                placeholder="Reply message template (supports %(first_name)s, %(vacancy_name)s, ...)"
                rows={2}
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
              />
              <div className="flex flex-wrap gap-3 text-xs mb-2">
                <label className="flex items-center gap-1">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={replyUseAi} onChange={(e) => setReplyUseAi(e.target.checked)} />
                  Use AI instead
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={replyOnlyInvitations}
                    onChange={(e) => setReplyOnlyInvitations(e.target.checked)}
                  />
                  Only invitations
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={replyDryRun} onChange={(e) => setReplyDryRun(e.target.checked)} />
                  Dry run
                </label>
              </div>
              <input
                className={`${inputClass} mb-2`}
                type="number"
                placeholder="Ignore responses older than N days"
                value={replyPeriod}
                onChange={(e) => setReplyPeriod(e.target.value)}
              />
              {(replyUseAi || aiFilter) && !aiLetterConfigured && (
                <p className="text-xs text-warning mb-2">
                  Configure an API key in Settings → "Jobs - AI Cover Letters" first.
                </p>
              )}
              <button onClick={handleReplyEmployers} disabled={replying} className="btn btn-primary btn-xs w-full">
                {replying ? "Sending..." : replyDryRun ? "Preview replies" : "Send replies"}
              </button>
            </div>

            <div className="border-t pt-2 mt-2" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <div className="text-xs opacity-60 mb-1">Clear old responses</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  className={inputClass}
                  type="number"
                  placeholder="Older than N days"
                  value={clearOlderThan}
                  onChange={(e) => setClearOlderThan(e.target.value)}
                />
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={clearBlacklistDiscard}
                    onChange={(e) => setClearBlacklistDiscard(e.target.checked)}
                  />
                  Blacklist on discard
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={clearDeleteChat} onChange={(e) => setClearDeleteChat(e.target.checked)} />
                  Delete chat too
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={clearNegDryRun} onChange={(e) => setClearNegDryRun(e.target.checked)} />
                  Dry run
                </label>
              </div>
              <button onClick={handleClearNegotiations} disabled={clearingNegotiations} className="btn btn-ghost btn-xs w-full">
                {clearingNegotiations ? "Running..." : "🗑 Clear responses"}
              </button>
            </div>

            <div className="border-t pt-2 mt-2" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <div className="text-xs opacity-60 mb-1">Clear skipped vacancies (local database only)</div>
              <div className="flex items-center gap-2 mb-2">
                <select className={selectClass} value={skippedReason} onChange={(e) => setSkippedReason(e.target.value)}>
                  <option value="">All reasons</option>
                  <option value="ai_rejected">AI rejected</option>
                  <option value="excluded_filter">Excluded filter</option>
                  <option value="blocked">Blocked</option>
                </select>
                <label className="flex items-center gap-1 text-xs flex-shrink-0">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={clearSkippedDryRun}
                    onChange={(e) => setClearSkippedDryRun(e.target.checked)}
                  />
                  Dry run
                </label>
              </div>
              <button onClick={handleClearSkipped} disabled={clearingSkipped} className="btn btn-ghost btn-xs w-full">
                {clearingSkipped ? "Running..." : "🗑 Clear skipped"}
              </button>
            </div>

            {progress.length > 0 && (
              <div className="bg-base-200 rounded p-2 text-xs font-mono max-h-40 overflow-y-auto space-y-0.5">
                {progress.map((p, i) => (
                  <div key={i} className="opacity-80 truncate">
                    {p.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "resumes" && (
          <div className="space-y-2">
            <button onClick={handleRefreshResumes} disabled={refreshingResumes} className="btn btn-ghost btn-xs">
              {refreshingResumes ? "Refreshing..." : "🔄 Refresh all resumes"}
            </button>
            <p className="text-xs opacity-50">Bumps every publishable resume back to the top of recruiter search results.</p>

            <div className="bg-base-200 rounded p-2">
              <div className="text-xs opacity-60 mb-1">🤖 Automation</div>
              <div className="flex items-center gap-2 mb-1">
                <input
                  className={`${inputClass} w-16`}
                  type="number"
                  min={2}
                  value={resumeAutoInterval}
                  onChange={(e) => setResumeAutoInterval(e.target.value)}
                  title="Interval in hours"
                />
                <span className="text-xs opacity-60">hrs</span>
                <button
                  onClick={() => handleSaveResumeAutomation(!resumeAutoEnabled)}
                  disabled={savingResumeAuto}
                  className={`btn btn-xs flex-1 ${resumeAutoEnabled ? "btn-error" : "btn-secondary"}`}
                >
                  {savingResumeAuto ? "Saving..." : resumeAutoEnabled ? "Disable" : "Enable"}
                </button>
              </div>
              <p className="text-xs opacity-50">
                {resumeAutoEnabled
                  ? `Next run: ${formatWhen(resumeAutoStatus.nextRunAt)} - Last: ${formatWhen(resumeAutoStatus.lastRunAt)} (${resumeAutoStatus.lastStatus || "-"})`
                  : "Only while the app is open."}
              </p>
            </div>

            {resumes.length === 0 && <p className="text-xs opacity-50">No resumes found. Sign in first.</p>}
            {resumes.map((r) => (
              <div key={r.id} className="bg-base-200 rounded p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium truncate">{r.title || r.id}</div>
                  <button
                    onClick={() => handleCloneResume(r.id)}
                    disabled={cloningResumeId === r.id}
                    className="btn btn-ghost btn-xs flex-shrink-0"
                    title="Clone this resume"
                  >
                    {cloningResumeId === r.id ? "..." : "📋 Clone"}
                  </button>
                </div>
                {r.updated_at && <div className="text-xs opacity-60">Updated {new Date(r.updated_at).toLocaleDateString()}</div>}
              </div>
            ))}

            <div className="border-t pt-2 mt-2" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <div className="text-xs opacity-60 mb-1">Create from template (.md / .toml)</div>
              <div className="flex items-center gap-2 mb-2">
                <input className={inputClass} placeholder="No file chosen" value={resumeTemplatePath} readOnly onClick={handleChooseResumeTemplate} />
                <button onClick={handleChooseResumeTemplate} className="btn btn-ghost btn-xs flex-shrink-0">
                  Choose file...
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs mb-2">
                <label className="flex items-center gap-1">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={resumeDryRun} onChange={(e) => setResumeDryRun(e.target.checked)} />
                  Dry run
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={resumePublish} onChange={(e) => setResumePublish(e.target.checked)} />
                  Publish immediately
                </label>
              </div>
              <button onClick={handleCreateResume} disabled={creatingResume || !resumeTemplatePath} className="btn btn-primary btn-xs w-full">
                {creatingResume ? "Running..." : "Create resume"}
              </button>
            </div>

            {progress.length > 0 && (
              <div className="bg-base-200 rounded p-2 text-xs font-mono max-h-40 overflow-y-auto space-y-0.5">
                {progress.map((p, i) => (
                  <div key={i} className="opacity-80 truncate">
                    {p.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "stats" && (
          <div className="space-y-2">
            {statsLoading && <p className="text-xs opacity-50">Loading...</p>}
            {!statsLoading && stats && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-base-200 rounded p-2">
                    <div className="opacity-60 text-xs">Total responses</div>
                    <div className="text-lg font-semibold">{stats.total_negotiations ?? 0}</div>
                  </div>
                  <div className="bg-base-200 rounded p-2">
                    <div className="opacity-60 text-xs">Total skipped</div>
                    <div className="text-lg font-semibold">{stats.total_skipped ?? 0}</div>
                  </div>
                </div>
                <div className="bg-base-200 rounded p-2">
                  <div className="opacity-60 text-xs mb-1">By state</div>
                  {topEntries(stats.by_state, 10).map(([state, count]) => (
                    <div key={state} className="flex justify-between text-xs py-0.5">
                      <span>{state}</span>
                      <span className="opacity-70">{count}</span>
                    </div>
                  ))}
                  {topEntries(stats.by_state, 10).length === 0 && <p className="text-xs opacity-50">No data yet.</p>}
                </div>
                <div className="bg-base-200 rounded p-2">
                  <div className="opacity-60 text-xs mb-1">Skipped by reason</div>
                  {topEntries(stats.skipped_by_reason, 10).map(([reason, count]) => (
                    <div key={reason} className="flex justify-between text-xs py-0.5">
                      <span className="truncate">{reason}</span>
                      <span className="opacity-70">{count}</span>
                    </div>
                  ))}
                  {topEntries(stats.skipped_by_reason, 10).length === 0 && <p className="text-xs opacity-50">No data yet.</p>}
                </div>
                <div className="bg-base-200 rounded p-2">
                  <div className="opacity-60 text-xs mb-1">Last 30 days (responses)</div>
                  {Object.entries(stats.daily_negotiations || {})
                    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
                    .slice(0, 7)
                    .map(([day, count]) => (
                      <div key={day} className="flex justify-between text-xs py-0.5">
                        <span>{day}</span>
                        <span className="opacity-70">{count}</span>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
};

export default JobsPage;
