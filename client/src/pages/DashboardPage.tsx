import { FormEvent, Fragment, useEffect, useState } from "react";
import { api } from "../lib/api";

type RepeatInterval = "none" | "every_3_hours" | "every_day" | "every_other_day";

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
    created_at: string;
    target_platforms: string[];
    prompt_template: string;
    generated_text?: string | null;
    generated_image_url?: string | null;
    generated_video_url?: string | null;
    ai_source?: string | null;
    ai_response_payload?: string | null;
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
  const APP_TIMEZONE = "Asia/Kolkata";
  const JOBS_PER_PAGE = 10;
  const appDateFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  const parseAiPayload = (value?: string | null) => {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as {
        response?: {
          data?: {
            source?: string;
            sources?: Array<{
              type?: string;
              label?: string;
              uri?: string | null;
            }>;
          };
        };
      };
    } catch {
      return null;
    }
  };

  const [keywordForm, setKeywordForm] = useState({ keyword: "", category: "" });
  const [jobForm, setJobForm] = useState({
    title: "",
    contentType: "text",
    promptTemplate: "",
    scheduledAt: "",
    repeatInterval: "none" as RepeatInterval,
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
  const [jobDetailsPage, setJobDetailsPage] = useState(1);
  const [openJobId, setOpenJobId] = useState<string | null>(null);

  const formatUtcTimestampToAppTimezone = (value: string) => {
    if (!value) {
      return "";
    }

    const normalized = value.replace("T", " ").replace("Z", "");
    const [datePart, timePart = "00:00:00"] = normalized.split(" ");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hourValue = 0, minuteValue = 0, secondValue = 0] = timePart.split(":").map(Number);

    return appDateFormatter.format(
      new Date(Date.UTC(year, Math.max(month - 1, 0), day, hourValue, minuteValue, secondValue))
    );
  };

  const formatAppLocalDateTime = (value: string) => {
    if (!value) {
      return "";
    }

    const normalized = value.replace("T", " ");
    const [datePart, timePart = "00:00:00"] = normalized.split(" ");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hourValue = 0, minuteValue = 0] = timePart.split(":").map(Number);

    const monthLabel = new Intl.DateTimeFormat("en-IN", {
      month: "short",
      timeZone: APP_TIMEZONE
    }).format(new Date(Date.UTC(year, Math.max(month - 1, 0), day)));

    const hour12 = hourValue % 12 || 12;
    const minute = String(minuteValue).padStart(2, "0");
    const meridiem = hourValue >= 12 ? "pm" : "am";

    return `${day} ${monthLabel} ${year}, ${hour12}:${minute} ${meridiem}`;
  };

  const formatScheduledAt = (value: string) => formatAppLocalDateTime(value);
  const formatCreatedAt = (value: string) => formatUtcTimestampToAppTimezone(value);

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

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(jobs.length / JOBS_PER_PAGE));
    if (jobDetailsPage > totalPages) {
      setJobDetailsPage(totalPages);
    }
  }, [jobDetailsPage, jobs.length]);

  const totalJobPages = Math.max(1, Math.ceil(jobs.length / JOBS_PER_PAGE));
  const pagedJobs = jobs.slice((jobDetailsPage - 1) * JOBS_PER_PAGE, jobDetailsPage * JOBS_PER_PAGE);

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
      publishEveryOtherDay: jobForm.repeatInterval === "every_other_day",
      scheduledAt: jobForm.scheduledAt.replace("T", " ") + ":00"
    });
    setJobForm({
      title: "",
      contentType: "text",
      promptTemplate: "",
      scheduledAt: "",
      repeatInterval: "none",
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

      <section className="card legal-links-card">
        <strong>Navigation & Links</strong>
        <div className="chip-list">
          <a className="chip link-chip" href="/published-posts">
            Published Posts
          </a>
          <a className="chip link-chip" href="/privacy-policy" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
          <a className="chip link-chip" href="/data-deletion" target="_blank" rel="noreferrer">
            Data Deletion
          </a>
          <a className="chip link-chip" href="/terms-of-service" target="_blank" rel="noreferrer">
            Terms of Service
          </a>
        </div>
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
            <select
              value={jobForm.repeatInterval}
              onChange={(event) => setJobForm({ ...jobForm, repeatInterval: event.target.value as RepeatInterval })}
            >
              <option value="none">Post once</option>
              <option value="every_3_hours">Post Every 3 hours</option>
              <option value="every_day">Post Every day</option>
              <option value="every_other_day">Post every alternate day</option>
            </select>

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
          {pagedJobs.map((job) => (
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
        <div className="pagination">
          <button
            type="button"
            className="chip"
            onClick={() => setJobDetailsPage((current) => Math.max(1, current - 1))}
            disabled={jobDetailsPage === 1}
          >
            Previous
          </button>
          <span>
            Page {jobDetailsPage} of {totalJobPages}
          </span>
          <button
            type="button"
            className="chip"
            onClick={() => setJobDetailsPage((current) => Math.min(totalJobPages, current + 1))}
            disabled={jobDetailsPage === totalJobPages}
          >
            Next
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Job Details</h2>
        <div className="connection-list">
          {pagedJobs.map((job) => {
            const payload = parseAiPayload(job.ai_response_payload);
            const sources = payload?.response?.data?.sources || [];
            const isOpen = openJobId === job.id;

            return (
              <div key={`${job.id}-details`} className="card accordion-card">
                <button
                  type="button"
                  className="accordion-toggle"
                  onClick={() => setOpenJobId((current) => current === job.id ? null : job.id)}
                >
                  <span>
                    <strong>{job.title}</strong>
                    <small>
                      {job.status} • {formatCreatedAt(job.created_at)}
                    </small>
                  </span>
                  <span>{isOpen ? "Hide" : "Show"}</span>
                </button>
                {isOpen ? (
                  <div className="accordion-content">
                   
                    <div className="stack">
                      <strong>Prompt Template</strong>
                      <p>{job.prompt_template}</p>
                    </div>
                    <div className="stack">
                      <strong>Generated Content</strong>
                      <p>{job.generated_text || job.generated_image_url || job.generated_video_url || "Not generated yet"}</p>
                    </div>
                     <div className="list-row">
                      <span>Status</span>
                      <span>{job.status}</span>
                    </div>
                    {/* <div className="list-row">
                      <span>Created</span>
                      <span>{formatCreatedAt(job.created_at)}</span>
                    </div> */}
                    <div className="list-row">
                      <span>Scheduled</span>
                      <span>{formatScheduledAt(job.scheduled_at)}</span>
                    </div>
                    <div className="list-row">
                      <span>Source</span>
                      <span>{job.ai_source || payload?.response?.data?.source || "N/A"}</span>
                    </div>
                    {sources.length ? (
                      <div className="stack">
                        <strong>Sources</strong>
                        <div className="chip-list">
                          {sources.map((source, index) => (
                            source.uri ? (
                              <a
                                key={`${job.id}-source-link-${index}`}
                                className="chip link-chip"
                                href={source.uri}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {source.label || source.uri}
                              </a>
                            ) : (
                              <span key={`${job.id}-source-label-${index}`} className="chip">
                                {source.label || source.type || "Unknown source"}
                              </span>
                            )
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="pagination">
          <button
            type="button"
            className="chip"
            onClick={() => setJobDetailsPage((current) => Math.max(1, current - 1))}
            disabled={jobDetailsPage === 1}
          >
            Previous
          </button>
          <span>
            Page {jobDetailsPage} of {totalJobPages}
          </span>
          <button
            type="button"
            className="chip"
            onClick={() => setJobDetailsPage((current) => Math.min(totalJobPages, current + 1))}
            disabled={jobDetailsPage === totalJobPages}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
};
