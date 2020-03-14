import React from 'react'
import { css } from '@emotion/core'
import { useTheme } from './Theming'

const Subscribe = ({ newsletterUrl, rss }) => {
  const theme = useTheme()
  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        justify-content: flex-start;
        p {
          margin-right: 10px;
          margin-left: auto;
        }
        a {
          border-radius: 4px;
          padding: 5px 7px;
          color: ${theme.colors.text};
          background: ${theme.colors.headerBg};
          cursor: pointer;
          :hover {
            color: ${theme.colors.link};
            text-decoration: none;
          }
        }
      `}
    >
      <p>
        Want to catch my next post? Subscribe via{' '}
        <a href={newsletterUrl}>Email</a> or <a href={rss}>RSS</a>
      </p>
    </div>
  )
}

export default Subscribe
