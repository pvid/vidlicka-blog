const path = require('path')

const _ = require('lodash')

const createPosts = (createPage, createRedirect, edges) => {
  edges.forEach(({ node }) => {
    const pagePath = node.fields.relativeUrl
    var template = undefined

    if (node.parent.sourceInstanceName === 'blog') {
      template = path.resolve(`./src/templates/blogpost.js`)
    } else {
      template = path.resolve(`./src/templates/page.js`)
    }

    if (node.frontmatter.redirects) {
      node.frontmatter.redirects.forEach(fromPath => {
        createRedirect({
          fromPath,
          toPath: pagePath,
          redirectInBrowser: true,
          isPermanent: true,
        })
      })
    }

    createPage({
      path: pagePath,
      component: template,
      context: {
        id: node.id,
      },
    })
  })
}

exports.createPages = ({ actions, graphql }) =>
  graphql(`
    query {
      allMdx(
        filter: { frontmatter: { published: { ne: false } } }
        sort: { order: DESC, fields: [frontmatter___date] }
      ) {
        edges {
          node {
            id
            parent {
              ... on File {
                name
                sourceInstanceName
              }
            }
            excerpt(pruneLength: 250)
            fields {
              relativeUrl
            }
            frontmatter {
              title
              slug
              date
              redirects
            }
          }
        }
      }
    }
  `).then(({ data, errors }) => {
    if (errors) {
      return Promise.reject(errors)
    }
    if (_.isEmpty(data.allMdx)) {
      return Promise.reject('There are no posts!')
    }

    const { edges } = data.allMdx
    const { createRedirect, createPage } = actions

    createRedirect({
      fromPath: '/',
      toPath: '/blog',
      redirectInBrowser: process.env.CLIENT_SIDE_REDIRECTS,
    })

    createPosts(createPage, createRedirect, edges)
    createBlogPage(actions.createPage, edges, '/blog', {})
  })

exports.onCreateWebpackConfig = ({ actions }) => {
  actions.setWebpackConfig({
    resolve: {
      modules: [path.resolve(__dirname, 'src'), 'node_modules'],
      alias: {
        'react-dom': '@hot-loader/react-dom',
        $components: path.resolve(__dirname, 'src/components'),
      },
    },
  })
}

const createBlogPage = (createPage, edges, pathPrefix, context) => {
  createPage({
    path: pathPrefix,
    component: path.resolve(`src/templates/blog.js`),
    context: context,
  })
}

exports.onCreateNode = ({ node, getNode, actions }) => {
  const { createNodeField } = actions

  if (node.internal.type === `Mdx`) {
    const parent = getNode(node.parent)

    createNodeField({
      name: 'relativeUrl',
      node,
      value:
        parent.sourceInstanceName === 'blog'
          ? `blog/${node.frontmatter.slug}`
          : node.frontmatter.slug,
    })

    createNodeField({
      name: 'isBlogPost',
      node,
      value: parent.sourceInstanceName === 'blog' ? true : false,
    })
  }
}
