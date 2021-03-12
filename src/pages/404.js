import React from 'react'
import { Link } from 'gatsby'

import Container from 'components/Container'
import SEO from '../components/SEO'
import Layout from '../components/Layout'

export default ({ data: { site } }) => (
  <Layout site={site}>
    <SEO />
    <Container noVerticalPadding>
      <div>
        <h1>Nothing in here!</h1>
        <p>
          Look at my{' '}
          <Link to="/blog" activeClassName="active" aria-label="View blog page">
            blog posts.
          </Link>{' '}
          You might find something interesting there.
        </p>
      </div>
    </Container>
  </Layout>
)

export const pageQuery = graphql`
  query {
    site {
      ...site
      siteMetadata {
        title
      }
    }
  }
`
