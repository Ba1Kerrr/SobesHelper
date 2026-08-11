import React, { useEffect, useState } from "react";

interface SjVacancy {
  id: number;
  profession: string;
  firm_name: string;
  town?: { title?: string };
  payment_from?: number;
  payment_to?: number;
  currency?: string;
  link: string;
}

const inputClass = "input input-bordered input-xs w-full bg-base-200";

const SuperJobPanel: React.FC = () => {
  const [authorized, setAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [authError, setAuthError] = useState("");

  const [keyword, setKeyword] = useState("");
  const [town, setTown] = useState("");
  const [paymentFrom, setPaymentFrom] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<SjVacancy[]>([]);
  const [total, setTotal] = useState(0);

  const refreshAuth = async () => {
    setCheckingAuth(true);
    try {
      const status = await window.electronAPI.superjobStatus();
      setAuthorized(!!status.authorized);
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  const handleLogin = async () => {
    setLoggingIn(true);
    setAuthError("");
    try {
      const result = await window.electronAPI.superjobLogin();
      if (result.status === "error") {
        setAuthError(result.message || "Login failed.");
      } else {
        await refreshAuth();
      }
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await window.electronAPI.superjobLogout();
    await refreshAuth();
  };

  const handleSearch = async () => {
    setSearching(true);
    setError("");
    try {
      const result = await window.electronAPI.superjobSearch({
        keyword: keyword.trim() || undefined,
        town: town.trim() || undefined,
        payment_from: paymentFrom ? Number(paymentFrom) : undefined,
      });
      if (result.status === "error") {
        setError(result.message || "Search failed.");
        setResults([]);
      } else {
        setResults((result.objects as SjVacancy[]) || []);
        setTotal(result.total || 0);
      }
    } finally {
      setSearching(false);
    }
  };

  const formatSalary = (v: SjVacancy) => {
    if (!v.payment_from && !v.payment_to) return "Salary not specified";
    const from = v.payment_from ? `${v.payment_from}` : "";
    const to = v.payment_to ? `${v.payment_to}` : "";
    return `${from}${from && to ? "-" : ""}${to} ${v.currency || ""}`.trim();
  };

  if (checkingAuth) {
    return <p className="text-xs opacity-50">Checking SuperJob session...</p>;
  }

  if (!authorized) {
    return (
      <div className="space-y-2">
        <p className="text-xs opacity-70">
          Sign in with your SuperJob.ru login/password (set the API app credentials in Settings first).
        </p>
        {authError && <p className="text-xs text-error">{authError}</p>}
        <button onClick={handleLogin} disabled={loggingIn} className="btn btn-primary btn-xs">
          {loggingIn ? "Signing in..." : "Sign in to SuperJob"}
        </button>
        <p className="text-xs opacity-50">
          Note: SuperJob's public API doesn't offer self-serve auto-apply for job seekers - search results here are
          real, but applying opens the vacancy on superjob.ru for you to submit manually.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between bg-base-200 rounded px-2 py-1.5">
        <span className="text-xs">✅ Signed in to SuperJob</span>
        <button onClick={handleLogout} className="btn btn-ghost btn-xs">
          Sign out
        </button>
      </div>

      <input
        className={inputClass}
        placeholder="Search query (e.g. Python developer)"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <input className={inputClass} placeholder="City" value={town} onChange={(e) => setTown(e.target.value)} />
        <input
          className={inputClass}
          type="number"
          placeholder="Min salary"
          value={paymentFrom}
          onChange={(e) => setPaymentFrom(e.target.value)}
        />
      </div>
      <button onClick={handleSearch} disabled={searching} className="btn btn-primary btn-xs w-full">
        {searching ? "Searching..." : "Search"}
      </button>
      {error && <p className="text-xs text-error">{error}</p>}

      {total > 0 && <p className="text-xs opacity-50">{total} vacancies found</p>}
      <div className="space-y-2">
        {results.map((v) => (
          <div key={v.id} className="card-surface bg-base-200 p-2">
            <div className="font-medium truncate">{v.profession}</div>
            <div className="text-xs opacity-70 truncate">
              {v.firm_name} {v.town?.title ? `· ${v.town.title}` : ""}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs opacity-60">{formatSalary(v)}</span>
              <button onClick={() => window.electronAPI.openExternal(v.link)} className="btn btn-ghost btn-xs">
                Apply on superjob.ru
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuperJobPanel;
