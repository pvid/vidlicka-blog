const config = require('./config/website')
const pathPrefix = config.pathPrefix === '/' ? '' : config.pathPrefix

require('dotenv').config({
  path: `.env.${process.env.NODE_ENV}`,
})
;(remarkPlugins = [
  {
    resolve: 'gatsby-remark-images',
    options: {
      backgroundColor: '#fafafa',
      maxWidth: 1035,
    },
  },
  {
    resolve: `gatsby-remark-vscode`,
    options: {
      theme: 'One Dark Pro',
      injectStyles: true,
      extensions: ['vsc-scala', 'vsc-prolog', 'material-theme'],
      logLevel: 'error', // Set to 'warn' to debug if something looks wrong
    },
  },
]),
  (module.exports = {
    pathPrefix: config.pathPrefix,
    siteMetadata: {
      siteUrl: config.siteUrl + pathPrefix,
      title: config.siteTitle,
      description: config.siteDescription,
      keywords: ['programming', 'developer', 'big data'],
      canonicalUrl: config.siteUrl,
      image: config.siteLogo,
      author: {
        name: config.author,
        minibio: `
        Big Data developer, mathematics graduate. Interested in databases,
        query languages and testability.
      `,
      },
      social: {
        fbAppID: '',
      },
    },
    plugins: [
      {
        resolve: 'gatsby-source-filesystem',
        options: {
          path: `${__dirname}/content/pages`,
          name: 'pages',
        },
      },
      {
        resolve: 'gatsby-source-filesystem',
        options: {
          path: `${__dirname}/content/blog`,
          name: 'blog',
        },
      },
      {
        resolve: `gatsby-plugin-mdx`,
        options: {
          extensions: ['.mdx', '.md', '.markdown'],
          gatsbyRemarkPlugins: remarkPlugins,
        },
      },
      `gatsby-remark-reading-time`,
      'gatsby-plugin-sharp',
      'gatsby-transformer-sharp',
      'gatsby-plugin-emotion',
      'gatsby-plugin-catch-links',
      'gatsby-plugin-react-helmet',
      'gatsby-plugin-netlify',
      {
        resolve: `gatsby-plugin-react-helmet-canonical-urls`,
        options: {
          siteUrl: config.siteUrl,
        },
      },
      {
        resolve: 'gatsby-plugin-manifest',
        options: {
          icon: 'static/images/logo.svg',
          icon_options: {
            purpose: `any maskable`,
          },
          name: config.siteTitle,
          short_name: config.siteTitleShort,
          description: config.siteDescription,
          start_url: config.pathPrefix,
          background_color: config.backgroundColor,
          theme_color: config.themeColor,
          display: 'standalone',
        },
      },
      {
        resolve: `gatsby-plugin-feed`,
        options: {
          query: `
          {
            site {
              siteMetadata {
                title
                description
                siteUrl
                site_url: siteUrl
              }
            }
          }
        `,
          feeds: [
            {
              serialize: ({ query: { site, allMdx } }) => {
                return allMdx.edges.map(edge => {
                  url =
                    site.siteMetadata.siteUrl +
                    '/' +
                    edge.node.fields.relativeUrl
                  return Object.assign({}, edge.node.frontmatter, {
                    description: edge.node.frontmatter.description,
                    date: edge.node.frontmatter.date,
                    url,
                    guid: url,
                  })
                })
              },
              query: `
              {
                allMdx(
                  limit: 1000,
                  sort: { order: DESC, fields: [frontmatter___date] }
                  filter: {
                    fields: { isBlogPost: { eq: true } }
                    frontmatter: { published: { eq: true } }
                  }
                ) {
                  edges {
                    node {
                      frontmatter {
                        title
                        slug
                        date
                        description
                      }
                      fields {
                        relativeUrl
                      }
                    }
                  }
                }
              }
            `,
              output: config.rss.relariveUrl,
              title: 'Vidlička Blog RSS Feed',
            },
          ],
        },
      },
      {
        resolve: `gatsby-plugin-typography`,
        options: {
          pathToConfigModule: `src/lib/typography`,
        },
      },
      'gatsby-plugin-offline',
    ],
  })
