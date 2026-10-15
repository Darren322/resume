import { ResumeExperience } from "./resume-experience";
import { resumeData } from "./resume-data";
import { profileLinks, site, siteUrl } from "./site";

const skills = resumeData.skills.items.flatMap((item) => item.visual.nodes);

// Describes the person this page is about; every claim here is also visible on the page.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "@id": `${siteUrl}/#profile`,
  url: siteUrl,
  name: site.title,
  description: site.description,
  inLanguage: "en-SG",
  mainEntity: {
    "@type": "Person",
    "@id": `${siteUrl}/#person`,
    name: site.fullName,
    alternateName: site.name,
    jobTitle: site.jobTitle,
    description: resumeData.profile.lede,
    url: siteUrl,
    image: `${siteUrl}/opengraph-image`,
    email: site.email,
    address: { "@type": "PostalAddress", addressLocality: site.locality, addressCountry: "SG" },
    worksFor: { "@type": "Organization", name: "Singapore Economic Development Board", url: "https://www.edb.gov.sg" },
    alumniOf: [
      { "@type": "CollegeOrUniversity", name: "Singapore Management University", url: "https://www.smu.edu.sg" },
      { "@type": "CollegeOrUniversity", name: "Nanyang Polytechnic", url: "https://www.nyp.edu.sg" },
    ],
    knowsAbout: skills,
    sameAs: [profileLinks.github, profileLinks.linkedin],
  },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ResumeExperience />
    </>
  );
}
