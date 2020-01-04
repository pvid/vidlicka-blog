import React from 'react'
import { css } from '@emotion/core'
import { useTheme } from './Theming'

const Subscribe = ({ url }) => {
  const theme = useTheme()
  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        justify-content: flex-start;
        a {
          border-radius: 4px;
          color: ${theme.colors.text};
          background: ${theme.colors.headerBg};
          padding: 10px 15px;
          margin-right: 10px;
          margin-left: auto;
          cursor: pointer;
          :hover {
            color: ${theme.colors.link};
            text-decoration: none;
          }
        }
      `}
    >
      <a href={url}>Subscribe to my newsletter</a>
    </div>
  )
}

export default Subscribe
