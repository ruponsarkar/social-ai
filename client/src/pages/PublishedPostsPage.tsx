import { useEffect, useState } from "react";
import { api } from "../lib/api";

type PublishedPost = {
  id: number;
  job_id: string;
  platform: "facebook" | "instagram" | "youtube";
  content_text: string | null;
  content_image_url: string | null;
  content_video_url: string | null;
  ai_source: string | null;
  ai_response_payload: string | null;
  external_post_id: string | null;
  published_at: string;
  job_title: string;
  content_type: "text" | "image" | "video";
  prompt_template: string;
  target_platforms: string[];
  job_created_at: string;
};

type PaginationInfo = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const PublishedPostsPage = () => {
  const APP_TIMEZONE = "Asia/Kolkata";
  const POSTS_PER_PAGE = 10;

  const appDateFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });

  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: POSTS_PER_PAGE,
    total: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const formatPublishedAt = (value: string) => {
    if (!value) {
      return "";
    }

    const normalized = value.replace("T", " ");
    const [datePart, timePart = "00:00:00"] = normalized.split(" ");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hourValue = 0, minuteValue = 0] = timePart.split(":").map(Number);

    return appDateFormatter.format(
      new Date(Date.UTC(year, Math.max(month - 1, 0), day, hourValue, minuteValue))
    );
  };

  const loadPublishedPosts = async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get("/published-posts", {
        params: { page, limit: POSTS_PER_PAGE }
      });

      setPublishedPosts(response.data.publishedPosts);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error("Error loading published posts:", err);
      setError("Failed to load published posts");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadPublishedPosts(newPage);
    }
  };

  useEffect(() => {
    void loadPublishedPosts();
  }, []);

  const renderContentPreview = (post: PublishedPost) => {
    if (post.content_type === "image" && post.content_image_url) {
      return (
        <div className="stack">
          <img
            src={post.content_image_url}
            alt="Published content"
            style={{ maxWidth: "200px", maxHeight: "200px", borderRadius: "8px" }}
          />
          {post.content_text && (
            <p style={{ margin: "8px 0", fontSize: "14px", color: "#476072" }}>
              {post.content_text.length > 100
                ? `${post.content_text.substring(0, 100)}...`
                : post.content_text}
            </p>
          )}
        </div>
      );
    }

    if (post.content_type === "video" && post.content_video_url) {
      return (
        <div className="stack">
          <video
            src={post.content_video_url}
            controls
            style={{ maxWidth: "200px", maxHeight: "200px", borderRadius: "8px" }}
          />
          {post.content_text && (
            <p style={{ margin: "8px 0", fontSize: "14px", color: "#476072" }}>
              {post.content_text.length > 100
                ? `${post.content_text.substring(0, 100)}...`
                : post.content_text}
            </p>
          )}
        </div>
      );
    }

    return (
      <p style={{ margin: 0, fontSize: "14px" }}>
        {post.content_text
          ? (post.content_text.length > 150
              ? `${post.content_text.substring(0, 150)}...`
              : post.content_text)
          : "No text content"}
      </p>
    );
  };

  return (
    <div className="layout">
      <section className="hero">
        <div>
          <div className="eyebrow">Published Content</div>
          <h1>All Published Posts</h1>
          <p className="hero-copy">
            View all your published posts across Facebook, Instagram, and YouTube with pagination.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => loadPublishedPosts(1)}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </section>

      {error && (
        <section className="card">
          <div style={{ color: "#d64545", fontWeight: "bold" }}>
            Error: {error}
          </div>
        </section>
      )}

      <section className="card">
        <h2>Published Posts ({pagination.total})</h2>

        {publishedPosts.length === 0 && !loading ? (
          <p style={{ color: "#476072", textAlign: "center", padding: "40px" }}>
            No published posts yet. Schedule and run some jobs to see them here.
          </p>
        ) : (
          <>
            <div className="table">
              <div className="table-row table-head">
                <span>Job Title</span>
                <span>Platform</span>
                <span>Type</span>
                <span>Content</span>
                <span>Published At</span>
                <span>External ID</span>
              </div>

              {publishedPosts.map((post) => {
                const payload = parseAiPayload(post.ai_response_payload);
                const sources = payload?.response?.data?.sources || [];

                return (
                  <div key={`${post.id}-${post.platform}`} className="table-row">
                    <span style={{ fontWeight: "500" }}>{post.job_title}</span>
                    <span style={{ textTransform: "capitalize" }}>{post.platform}</span>
                    <span style={{ textTransform: "capitalize" }}>{post.content_type}</span>
                    <span>{renderContentPreview(post)}</span>
                    <span>{formatPublishedAt(post.published_at)}</span>
                    <span style={{ fontSize: "12px", color: "#476072" }}>
                      {post.external_post_id || "N/A"}
                    </span>
                  </div>
                );
              })}
            </div>

            {pagination.totalPages > 1 && (
              <div className="pagination">
                <button
                  className="page-button"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || loading}
                >
                  Previous
                </button>

                <span style={{ color: "#476072", fontSize: "14px" }}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>

                <button
                  className="page-button"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || loading}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
