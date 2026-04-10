import { FormEvent, Fragment, useEffect, useState } from "react";
import { api } from "../lib/api";

type DashboardPageProps = {
  stats: {
    totalKeywords: number;
    totalJobs: number;
    scheduledJobs: number;
    publishedJobs: number;
  } | null;
  keywords: Array<{ id: number; keyword: string; category: string }>;
  jobs: Array<{
    id: string;
    title: string;
    content_type: "text" | "image" | "video";
    status: string;
    scheduled_at: string;
    target_platforms: string[];
    error_message?: string | null;
  }>;
  connections: Array<{
    id: number;
    platform: string;
    account_name: string;
    is_active: number;
  }>;
  onRefresh: () => Promise<void>;
};

export const DashboardPage = ({
  stats,
  keywords,
  jobs,
  connections,
  onRefresh
}: DashboardPageProps) => {
  const [keywordForm, setKeywordForm] = useState({ keyword: "", category: "" });
  const [jobForm, setJobForm] = useState({
    title: "",
    contentType: "text",
    promptTemplate: "",
    scheduledAt: "",
    publishEveryOtherDay: false,
    keywordIds: [] as number[],
    targetPlatforms: ["facebook"] as string[]
  });
  const [connectionForm, setConnectionForm] = useState({
    platform: "facebook",
    accountName: "",
    accessToken: "",
    refreshToken: "",
    pageId: "",
    channelId: ""
  });
  const [oauthMessage, setOauthMessage] = useState("");

  const formatScheduledAt = (value: string) =>
    new Date(value.replace(" ", "T")).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true 
    });

  useEffect(() => {
    const url = new URL(window.location.href);
    const message = url.searchParams.get("message");

    if (message) {
      setOauthMessage(message);
      url.searchParams.delete("message");
      window.history.replaceState({}, "", url.toString());
      void onRefresh();
    }
  }, []);

  const submitKeyword = async (event: FormEvent) => {
    event.preventDefault();
    await api.post("/keywords", keywordForm);
    setKeywordForm({ keyword: "", category: "" });
    await onRefresh();
  };

  const submitJob = async (event: FormEvent) => {
    event.preventDefault();
    await api.post("/jobs", {
      ...jobForm,
      scheduledAt: jobForm.scheduledAt.replace("T", " ") + ":00"
    });
    setJobForm({
      title: "",
      contentType: "text",
      promptTemplate: "",
      scheduledAt: "",
      publishEveryOtherDay: false,
      keywordIds: [],
      targetPlatforms: ["facebook"]
    });
    await onRefresh();
  };

  const submitConnection = async (event: FormEvent) => {
    event.preventDefault();
    await api.post("/connections", connectionForm);
    setConnectionForm({
      platform: "facebook",
      accountName: "",
      accessToken: "",
      refreshToken: "",
      pageId: "",
      channelId: ""
    });
    await onRefresh();
  };

  const runNow = async () => {
    const response = await api.post("/jobs/run-now");
    const result = response.data?.result;

    if (result) {
      setOauthMessage(
        `Scheduler checked ${result.found} job(s), processed ${result.processed}, failed ${result.failed}.`
      );
    }

    await onRefresh();
  };

  const deleteJob = async (id: string) => {
    await api.delete(`/jobs/${id}`);
    setOauthMessage("Scheduled job deleted.");
    await onRefresh();
  };

  const startOAuthConnect = async (provider: "meta" | "google") => {
    const response = await api.get(`/oauth/${provider}/start`, {
      params: {
        returnTo: "/"
      }
    });

    window.location.href = response.data.url;
  };

  const togglePlatform = (platform: string) => {
    if (jobForm.contentType === "text" && platform === "instagram") {
      setOauthMessage("Instagram does not support text-only publishing from this API. Use an image or video job instead.");
      return;
    }

    if (jobForm.contentType !== "video" && platform === "youtube") {
      setOauthMessage("YouTube publishing is only available for video jobs.");
      return;
    }

    setJobForm((current) => ({
      ...current,
      targetPlatforms: current.targetPlatforms.includes(platform)
        ? current.targetPlatforms.filter((value) => value !== platform)
        : [...current.targetPlatforms, platform]
    }));
  };

  const toggleKeyword = (id: number) => {
    setJobForm((current) => ({
      ...current,
      keywordIds: current.keywordIds.includes(id)
        ? current.keywordIds.filter((value) => value !== id)
        : [...current.keywordIds, id]
    }));
  };

  const handleContentTypeChange = (contentType: "text" | "image" | "video") => {
    setJobForm((current) => {
      const nextPlatforms = current.targetPlatforms.filter((platform) => {
        if (contentType === "text" && platform === "instagram") {
          return false;
        }

        if (contentType !== "video" && platform === "youtube") {
          return false;
        }

        return true;
      });

      return {
        ...current,
        contentType,
        targetPlatforms: nextPlatforms.length > 0 ? nextPlatforms : ["facebook"]
      };
    });
  };

  return (
    <div className="layout">
      <section className="hero">
        <div>
          <p className="eyebrow">AI Social Publishing</p>
          <h1>Manage Facebook, Instagram, and YouTube from one workflow.</h1>
          <p className="hero-copy">
            Schedule text posts, AI image posts, and alternate-day video publishing with a single dashboard.
          </p>
        </div>
        <button className="primary-button" onClick={() => void runNow()}>
          Run Scheduler Now
        </button>
      </section>

      {oauthMessage ? (
        <section className="card">
          <strong>{oauthMessage}</strong>
        </section>
      ) : null}

      <section className="stats-grid">
        <article className="card stat-card">
          <span>Total Keywords</span>
          <strong>{stats?.totalKeywords ?? 0}</strong>
        </article>
        <article className="card stat-card">
          <span>Total Jobs</span>
          <strong>{stats?.totalJobs ?? 0}</strong>
        </article>
        <article className="card stat-card">
          <span>Scheduled</span>
          <strong>{stats?.scheduledJobs ?? 0}</strong>
        </article>
        <article className="card stat-card">
          <span>Published</span>
          <strong>{stats?.publishedJobs ?? 0}</strong>
        </article>
      </section>

      <section className="panel-grid">
        <article className="card">
          <h2>Add Keyword</h2>
          <form className="stack" onSubmit={submitKeyword}>
            <input
              value={keywordForm.keyword}
              onChange={(event) => setKeywordForm({ ...keywordForm, keyword: event.target.value })}
              placeholder="Keyword"
              required
            />
            <input
              value={keywordForm.category}
              onChange={(event) => setKeywordForm({ ...keywordForm, category: event.target.value })}
              placeholder="Category"
            />
            <button className="primary-button" type="submit">Save Keyword</button>
          </form>
          <div className="chip-list">
            {keywords.map((keyword) => (
              <span key={keyword.id} className="chip">
                {keyword.keyword}
              </span>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>Create Content Job</h2>
          <form className="stack" onSubmit={submitJob}>
            <input
              value={jobForm.title}
              onChange={(event) => setJobForm({ ...jobForm, title: event.target.value })}
              placeholder="Campaign title"
              required
            />
            <select
              value={jobForm.contentType}
              onChange={(event) => handleContentTypeChange(event.target.value as "text" | "image" | "video")}
            >
              <option value="text">Text Post</option>
              <option value="image">Image Post</option>
              <option value="video">Short Video</option>
            </select>
            <textarea
              value={jobForm.promptTemplate}
              onChange={(event) => setJobForm({ ...jobForm, promptTemplate: event.target.value })}
              placeholder="Describe what the AI should create"
              rows={4}
              required
            />
            <input
              type="datetime-local"
              value={jobForm.scheduledAt}
              onChange={(event) => setJobForm({ ...jobForm, scheduledAt: event.target.value })}
              required
            />
            <label className="toggle">
              <input
                type="checkbox"
                checked={jobForm.publishEveryOtherDay}
                onChange={(event) => setJobForm({ ...jobForm, publishEveryOtherDay: event.target.checked })}
              />
              Post every alternate day
            </label>

            <div>
              <p className="subheading">Platforms</p>
              <div className="chip-list">
                {["facebook", "instagram", "youtube"].map((platform) => (
                  <button
                    key={platform}
                    type="button"
                    className={jobForm.targetPlatforms.includes(platform) ? "chip active-chip" : "chip"}
                    onClick={() => togglePlatform(platform)}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="subheading">Keywords</p>
              <div className="chip-list">
                {keywords.map((keyword) => (
                  <button
                    key={keyword.id}
                    type="button"
                    className={jobForm.keywordIds.includes(keyword.id) ? "chip active-chip" : "chip"}
                    onClick={() => toggleKeyword(keyword.id)}
                  >
                    {keyword.keyword}
                  </button>
                ))}
              </div>
            </div>

            <button className="primary-button" type="submit">Schedule Job</button>
          </form>
        </article>

        <article className="card">
          <h2>Platform Connection</h2>
          <div className="chip-list">
            <button className="primary-button" type="button" onClick={() => void startOAuthConnect("meta")}>
              Connect Meta
            </button>
            <button className="primary-button" type="button" onClick={() => void startOAuthConnect("google")}>
              Connect YouTube
            </button>
          </div>
          <form className="stack" onSubmit={submitConnection}>
            <select
              value={connectionForm.platform}
              onChange={(event) => setConnectionForm({ ...connectionForm, platform: event.target.value })}
            >
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
            </select>
            <input
              value={connectionForm.accountName}
              onChange={(event) => setConnectionForm({ ...connectionForm, accountName: event.target.value })}
              placeholder="Account name"
              required
            />
            <input
              value={connectionForm.accessToken}
              onChange={(event) => setConnectionForm({ ...connectionForm, accessToken: event.target.value })}
              placeholder="Access token"
            />
            <input
              value={connectionForm.refreshToken}
              onChange={(event) => setConnectionForm({ ...connectionForm, refreshToken: event.target.value })}
              placeholder="Refresh token for YouTube OAuth"
            />
            <input
              value={connectionForm.pageId}
              onChange={(event) => setConnectionForm({ ...connectionForm, pageId: event.target.value })}
              placeholder="Facebook Page ID or Instagram Business Account ID"
            />
            <input
              value={connectionForm.channelId}
              onChange={(event) => setConnectionForm({ ...connectionForm, channelId: event.target.value })}
              placeholder="YouTube Channel ID"
            />
            <button className="primary-button" type="submit">Store Connection</button>
          </form>
          <div className="connection-list">
            {connections.map((connection) => (
              <div key={connection.id} className="list-row">
                <span>{connection.platform}</span>
                <span>{connection.account_name}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="card">
        <h2>Scheduled Jobs</h2>
        <div className="table">
          <div className="table-row table-head">
            <span>Title</span>
            <span>Type</span>
            <span>Platforms</span>
            <span>Status</span>
            <span>Scheduled</span>
            <span>Action</span>
          </div>
          {jobs.map((job) => (
            <Fragment key={job.id}>
              <div className="table-row">
                <span>{job.title}</span>
                <span>{job.content_type}</span>
                <span>{job.target_platforms.join(", ")}</span>
                <span>{job.status}</span>
                <span>{formatScheduledAt(job.scheduled_at)}</span>
                <span>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void deleteJob(job.id)}
                  >
                    Delete
                  </button>
                </span>
              </div>
              {job.error_message ? (
                <div className="table-row">
                  <span>Error</span>
                  <span>{job.error_message}</span>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>
      </section>
    </div>
  );
};
