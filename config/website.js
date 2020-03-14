module.exports = {
  pathPrefix: '/', // Prefix for all links. If you deploy your site to example.com/blog your pathPrefix should be "blog"
  siteTitle: 'Vidlička', // Navigation and Site Title
  siteTitleAlt: 'Vidlička Tech Blog', // Alternative Site title for SEO
  siteTitleShort: 'Vidlička blog', // short_name for manifest
  siteUrl: 'https://vidlicka.dev', // Domain of your site. No trailing slash!
  siteLanguage: 'en', // Language Tag on <html> element
  siteLogo: 'images/logo.svg', // Used for SEO and manifest, path to your image you placed in the 'static' folder
  siteDescription: 'This is where they post things!',
  author: 'Pavol Vidlička', // Author for schemaORGJSONLD

  ogSiteName: "Pavol Vidlička's blog", // Facebook Site Name
  ogLanguage: 'en_US',

  // Manifest and Progress color
  themeColor: '#e6e6e6',
  backgroundColor: '#e6e6e6',

  // Social component
  github: 'https://github.com/pvid/',
  linkedin: 'https://www.linkedin.com/in/pavol-vidlicka',
  email: 'pavol.vidlicka@gmail.com',

  // Comments
  comments: {
    repo: 'pvid/vidlicka-blog-comments',
    branch: 'master',
    'issue-term': 'url',
    label: 'comments',
  },

  // Newsletter
  newsletter: {
    url:
      'https://gmail.us4.list-manage.com/subscribe/post?u=ddc09f566f977379b0b16d919&amp;id=2ddbd1b5a3',
  },
}
