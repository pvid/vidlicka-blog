import { createTheming } from '@callstack/react-theme-provider'
import { lighten, darken } from 'polished'
import colors from '../lib/colors'

const themes = {
  default: {
    themeName: 'default',
    colors: {
      primary: darken(0.1, colors.white),
      text: colors.black,
      headerText: colors.black,
      bodyBg: colors.gray,
      headerBg: darken(0.1, colors.white),
      link: colors.red,
      ...colors,
    },
  },
  dark: {
    themeName: 'dark',
    colors: {
      primary: lighten(0.1, colors.black),
      text: colors.white,
      headerText: colors.white,
      bodyBg: lighten(0.05, colors.black),
      headerBg: lighten(0.1, colors.black),
      link: lighten(0.1, colors.red),
      ...colors,
    },
  },
}

const { ThemeProvider, withTheme, useTheme } = createTheming(themes.default)

export { ThemeProvider, withTheme, useTheme, themes, colors }
