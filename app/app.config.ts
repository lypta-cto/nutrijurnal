/*
 * Nuxt UI themed for a phone: pill buttons and 44 px controls a thumb can hit,
 * soft sheets, warm overlays. The palettes behind the colour names are in
 * assets/css/main.css; the reasoning is in docs/design.md.
 */
export default defineAppConfig({
  // Branding — the mark itself lives in components/shell/LogoMark.vue
  app: {
    name: 'Nutrijurnal',
    tagline: 'Your food diary, one plate at a time.'
  },

  ui: {
    colors: {
      primary: 'basil',
      success: 'basil',
      warning: 'clay',
      error: 'rose',
      // Water — teal, so a glass never reads as protein's sky
      info: 'teal',
      neutral: 'oat'
    },

    // md is the 44 px default; xs and sm are for dense rows that are themselves the target
    button: {
      slots: {
        base: 'rounded-full font-semibold transition-[color,background-color,box-shadow,transform] duration-120 ease-soft enabled:active:scale-[0.97]'
      },
      variants: {
        size: {
          sm: { base: 'px-3 py-2' },
          md: { base: 'px-4 py-3 gap-2' },
          lg: { base: 'px-5 py-3 text-base gap-2' },
          xl: { base: 'px-6 py-4 text-base gap-2.5', leadingIcon: 'size-6', trailingIcon: 'size-6' }
        }
      },
      compoundVariants: [
        { size: 'sm', square: true, class: 'p-2' },
        { size: 'md', square: true, class: 'p-3' },
        { size: 'lg', square: true, class: 'p-3.5' },
        { size: 'xl', square: true, class: 'p-4' }
      ]
    },

    input: {
      slots: { base: 'rounded-control' },
      variants: {
        size: {
          xs: { base: 'rounded-lg' },
          sm: { base: 'rounded-lg' },
          md: { base: 'px-3.5 py-3 gap-2', leading: 'ps-3.5', trailing: 'pe-3.5' },
          lg: { base: 'px-4 py-3.5 gap-2', leading: 'ps-4', trailing: 'pe-4' }
        }
      },
      compoundVariants: [
        { leading: true, size: 'md', class: 'ps-11' },
        { leading: true, size: 'lg', class: 'ps-12' },
        { trailing: true, size: 'md', class: 'pe-11' },
        { trailing: true, size: 'lg', class: 'pe-12' }
      ]
    },

    textarea: {
      slots: { base: 'rounded-control' },
      variants: {
        size: {
          md: { base: 'px-3.5 py-3' },
          lg: { base: 'px-4 py-3.5' }
        }
      }
    },

    select: {
      slots: {
        base: 'rounded-control',
        content: 'z-50 rounded-tile shadow-overlay',
        item: 'rounded-lg'
      },
      variants: {
        size: {
          md: { base: 'px-3.5 py-3 text-base/5', item: 'p-2.5' },
          lg: { base: 'px-4 py-3.5 text-base/5', item: 'p-3' }
        }
      }
    },

    formField: {
      slots: {
        label: 'font-semibold text-highlighted',
        help: 'mt-1.5 text-muted',
        error: 'mt-1.5 text-error'
      }
    },

    // Bottom sheets: a big soft radius, a dimmed (not frosted-white) backdrop.
    // Everything that floats is z-50: above the app bar (30) and the tab bar (40),
    // under the confirm dialog (60) and toasts (100)
    drawer: {
      slots: {
        overlay: 'z-50 bg-oat-950/40 backdrop-blur-[2px]',
        content: 'z-50 ring-0 shadow-overlay',
        handle: '!bg-accented',
        container: 'gap-5 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]',
        title: 'text-headline font-semibold text-highlighted',
        description: 'mt-0.5 text-sm text-muted'
      },
      compoundVariants: [
        { direction: 'bottom', inset: false, class: { content: 'rounded-t-sheet' } }
      ]
    },

    modal: {
      slots: {
        overlay: 'z-50 bg-oat-950/40 backdrop-blur-[2px]',
        content: 'z-50',
        title: 'text-headline font-semibold text-highlighted',
        description: 'mt-0.5 text-sm text-muted',
        header: 'px-5',
        body: 'px-5',
        footer: 'px-5'
      },
      variants: {
        fullscreen: {
          false: { content: 'w-[calc(100vw-2rem)] rounded-sheet ring-0 shadow-overlay' }
        }
      }
    },

    slideover: {
      slots: {
        overlay: 'z-50 bg-oat-950/40 backdrop-blur-[2px]',
        content: 'z-50 shadow-overlay',
        title: 'text-headline font-semibold text-highlighted'
      }
    },

    dropdownMenu: {
      slots: {
        content: 'z-50 min-w-44 rounded-tile shadow-overlay ring-default',
        item: 'before:rounded-lg'
      },
      variants: {
        size: {
          md: { item: 'px-2.5 py-2.5 gap-2.5' }
        }
      }
    },

    selectMenu: {
      slots: {
        content: 'z-50 rounded-tile shadow-overlay'
      }
    },

    popover: {
      slots: {
        content: 'z-50 rounded-tile shadow-overlay'
      }
    },

    tooltip: {
      slots: {
        content: 'z-50'
      }
    },

    toast: {
      slots: {
        root: 'rounded-tile shadow-overlay',
        title: 'font-semibold'
      }
    },

    card: {
      slots: {
        root: 'rounded-card shadow-card'
      }
    },

    alert: {
      slots: {
        root: 'rounded-tile'
      }
    },

    skeleton: {
      base: 'rounded-lg bg-elevated'
    },

    authForm: {
      slots: {
        root: 'space-y-7',
        header: 'text-left',
        title: 'font-display text-title text-highlighted',
        description: 'mt-1.5 text-sm text-muted',
        footer: 'text-sm text-muted mt-1'
      }
    }
  }
})
