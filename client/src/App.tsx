import { useEffect, useState } from "react";
import { api } from "./lib/api";
import { DashboardPage } from "./pages/DashboardPage";

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
  target_platforms: string[];
};

type Connection = {
  id: number;
  platform: string;
  account_name: string;
  is_active: number;
};

export default function App() {
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
    void loadData();
  }, []);

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

