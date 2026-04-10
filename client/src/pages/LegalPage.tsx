type LegalPageProps = {
  title: string;
  updatedOn: string;
  sections: Array<{
    heading: string;
    paragraphs: string[];
  }>;
};

export const LegalPage = ({ title, updatedOn, sections }: LegalPageProps) => {
  return (
    <main className="legal-shell">
      <div className="legal-card">
        <p className="eyebrow">Social Media Manager</p>
        <h1 className="legal-title">{title}</h1>
        <p className="legal-meta">Last updated: {updatedOn}</p>

        {sections.map((section) => (
          <section key={section.heading} className="legal-section">
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={`${section.heading}-${index}`}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
};

