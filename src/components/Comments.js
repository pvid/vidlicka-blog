import React, { useEffect } from 'react'
import { useTheme } from './Theming'
import config from '../../config/website'

const src = 'https://utteranc.es/client.js'

export const Comments = ({ comments = config.comments }) => {
  const theme = useTheme()
  const rootElm = React.createRef()

  useEffect(() => {
    const utterances = document.createElement('script')

    const utterancesConfig = {
      src,
      repo: comments.repo,
      branch: comments.branch,
      label: comments.label,
      async: true,
      theme: theme.themeName === 'default' ? 'github-light' : 'github-dark',
      'issue-term': comments['issue-term'],
      crossorigin: 'anonymous',
    }

    Object.keys(utterancesConfig).forEach(configKey => {
      utterances.setAttribute(configKey, utterancesConfig[configKey])
    })
    const child = rootElm.current.lastChild
    if (child) {
      rootElm.current.replaceChild(utterances, child)
    } else {
      rootElm.current.appendChild(utterances)
    }
  }, [rootElm, theme, comments])

  return <div ref={rootElm} />
}

export default Comments
