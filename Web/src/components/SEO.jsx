import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ 
  title = "4i Global Sports Hub - Premium Sports Gear", 
  description = "Discover the best sports gear and products at 4i Global Sports Hub. Shop premium quality items with seamless experience.", 
  name = "4i Global Sports Hub", 
  type = "website",
  image = "/logo.jpeg",
  url = "https://4iglobalsportshub.co"
}) => {
  return (
    <Helmet>
      {/* Standard metadata tags */}
      <title>{title}</title>
      <meta name='description' content={description} />
      
      {/* Facebook tags */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={name} />
      
      {/* Twitter tags */}
      <meta name="twitter:creator" content={name} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
};

export default SEO;
