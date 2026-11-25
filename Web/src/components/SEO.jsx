import React from "react";
import { Helmet } from "react-helmet-async";

export default function SEO({
  title = "Lira Workspace — Team & Office Task Management",
  description = "Manage team projects, track deadlines, approve requests, and collaborate in one workspace.",
  name = "Lira Workspace",
  type = "website",
  url = "https://incuman.com",
}) {
  return (
    <Helmet>
      {/* Standard metadata tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="author" content="Incuman Technologies" />
      <link rel="canonical" href={url} />

      {/* Facebook / OpenGraph tags */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content={name} />
      <meta property="og:url" content={url} />

      {/* Twitter tags */}
      <meta name="twitter:creator" content="@incuman" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
}
