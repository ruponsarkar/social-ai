import { useEffect, useState } from "react";
import { api } from "./lib/api";
import { DashboardPage } from "./pages/DashboardPage";
import { LegalPage } from "./pages/LegalPage";
import { PublishedPostsPage } from "./pages/PublishedPostsPage";

type DashboardStats = {
  totalKeywords: number;
  totalJobs: number;
  scheduledJobs: number;
  publishedJobs: number;
};

type Keyword = {
  id: number;
  keyword: string;
  category: string;
};

type Job = {
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
};

type Connection = {
  id: number;
  platform: string;
  account_name: string;
  is_active: number;
};

export default function App() {
  const pathname = window.location.pathname.toLowerCase();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  const loadData = async () => {
    const [statsRes, keywordsRes, jobsRes, connectionsRes] = await Promise.all([
      api.get("/dashboard/stats"),
      api.get("/keywords"),
      api.get("/jobs"),
      api.get("/connections")
    ]);

    setStats(statsRes.data);
    setKeywords(keywordsRes.data);
    setJobs(jobsRes.data);
    setConnections(connectionsRes.data);
  };

  useEffect(() => {
    if (pathname !== "/") {
      return;
    }

    void loadData();
  }, [pathname]);

  if (pathname === "/privacy-policy") {
    return (
      <LegalPage
        title="Privacy Policy"
        updatedOn="April 10, 2026"
        sections={[
          {
            heading: "Overview",
            paragraphs: [
              "Social Media Manager helps businesses and creators generate, schedule, and publish content to connected social media platforms. This Privacy Policy explains what information we collect, how we use it, and how users can contact us about privacy-related requests."
            ]
          },
          {
            heading: "Information We Collect",
            paragraphs: [
              "We may collect account profile information, connected page or channel identifiers, access tokens provided through platform authorization flows, keyword and campaign data entered into the dashboard, generated content assets, and publishing logs created when content is sent to Facebook, Instagram, or YouTube.",
              "We do not intentionally collect sensitive personal data unless it is included by a user in content prompts or connected account information."
            ]
          },
          {
            heading: "How We Use Information",
            paragraphs: [
              "We use the collected information to authenticate connected social accounts, generate and schedule content, publish approved posts, maintain audit logs, improve product reliability, and respond to support or compliance requests.",
              "Connected platform data is used only to provide the services requested by the account owner and is not sold to third parties."
            ]
          },
          {
            heading: "Data Sharing",
            paragraphs: [
              "We may share data with service providers and platform APIs strictly as needed to operate the application, including AI generation providers, hosting providers, database providers, and social network APIs such as Meta and YouTube.",
              "We may also disclose information when required by law, regulation, or a valid legal process."
            ]
          },
          {
            heading: "Retention and Security",
            paragraphs: [
              "We retain connected account information, generated assets, scheduled jobs, and publish logs for as long as needed to operate the service and maintain business records, unless a deletion request is received.",
              "Reasonable administrative and technical safeguards are used to protect stored data, but no internet-based system can be guaranteed fully secure."
            ]
          },
          {
            heading: "Your Rights and Contact",
            paragraphs: [
              "Users may request access, correction, or deletion of data associated with their connected account by emailing pageuptechnologies@gmail.com.",
              "Privacy and data handling questions can also be sent to pageuptechnologies@gmail.com."
            ]
          }
        ]}
      />
    );
  }

  if (pathname === "/data-deletion") {
    return (
      <LegalPage
        title="Data Deletion Instructions"
        updatedOn="April 10, 2026"
        sections={[
          {
            heading: "Requesting Deletion",
            paragraphs: [
              "If you connected your Facebook, Instagram, or YouTube account to Social Media Manager and want your data removed, email pageuptechnologies@gmail.com with the subject line Data Deletion Request.",
              "Please include the name of the connected page, account, or channel and the email address used to contact support so we can identify the correct records."
            ]
          },
          {
            heading: "What We Delete",
            paragraphs: [
              "Upon verification, we will delete stored platform connection records, access tokens, refresh tokens, scheduled jobs, generated content drafts, and related publish logs associated with the requesting account, unless retention is required for security, legal, or accounting reasons."
            ]
          },
          {
            heading: "Response Timeline",
            paragraphs: [
              "We aim to acknowledge deletion requests within 7 business days and complete eligible deletion within 30 business days."
            ]
          },
          {
            heading: "Questions",
            paragraphs: [
              "If you need help with a deletion request, contact pageuptechnologies@gmail.com."
            ]
          }
        ]}
      />
    );
  }

  if (pathname === "/terms-of-service") {
    return (
      <LegalPage
        title="Terms of Service"
        updatedOn="April 10, 2026"
        sections={[
          {
            heading: "Acceptance of Terms",
            paragraphs: [
              "By using Social Media Manager, you agree to these Terms of Service. If you do not agree, do not use the service."
            ]
          },
          {
            heading: "Service Description",
            paragraphs: [
              "Social Media Manager provides tools for generating, scheduling, and publishing social media content to connected third-party platforms. Features may change, improve, or be removed over time."
            ]
          },
          {
            heading: "User Responsibilities",
            paragraphs: [
              "You are responsible for ensuring that you have authority to connect and publish to any Facebook Page, Instagram account, or YouTube channel used with the service.",
              "You agree not to use the service to publish unlawful, infringing, misleading, or abusive content, and you are responsible for reviewing AI-generated content before use."
            ]
          },
          {
            heading: "Third-Party Platforms",
            paragraphs: [
              "Use of connected platforms is also subject to the terms, policies, and technical limitations of Meta, YouTube, and any other external services involved. We are not responsible for platform-side restrictions, account penalties, or API changes."
            ]
          },
          {
            heading: "Disclaimers and Liability",
            paragraphs: [
              "The service is provided on an as-is and as-available basis without warranties of any kind. To the maximum extent permitted by law, we disclaim liability for indirect, incidental, or consequential damages resulting from use of the service."
            ]
          },
          {
            heading: "Contact",
            paragraphs: [
              "Questions about these terms may be sent to pageuptechnologies@gmail.com."
            ]
          }
        ]}
      />
    );
  }

  if (pathname === "/published-posts") {
    return <PublishedPostsPage />;
  }

  return (
    <DashboardPage
      stats={stats}
      keywords={keywords}
      jobs={jobs}
      connections={connections}
      onRefresh={loadData}
    />
  );
}
