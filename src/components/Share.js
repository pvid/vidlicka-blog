import React from 'react'
import { css } from '@emotion/core'
import { useTheme } from './Theming'
import { CopyToClipboard } from 'react-copy-to-clipboard'

import { TwitterShareButton, FacebookShareButton } from 'react-share'

const Share = ({ url, title }) => {
  const theme = useTheme()
  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        justify-content: flex-start;
        div {
          margin-right: 20px;
          cursor: pointer;
          :hover {
            color: ${theme.colors.link};
          }
        }
        span {
          margin-right: 20px;
          font-size: 70%;
          text-transform: uppercase;
          line-height: 2.5;
          opacity: 0.7;
        }
      `}
    >
      <div
        css={css`
          flex-grow: 1;
        `}
      />
      <span>Share article</span>

      <CopyToClipboard text={url}>
        <div>Copy link</div>
      </CopyToClipboard>

      <TwitterShareButton url={url} quote={title}>
        <div>Twitter</div>
      </TwitterShareButton>

      <FacebookShareButton
        url={url}
        quote={title}
        css={css`
          cursor: pointer;
        `}
      >
        <div>Facebook</div>
      </FacebookShareButton>
    </div>
  )
}

export default Share
