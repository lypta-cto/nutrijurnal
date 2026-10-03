/*
 * Nuxt UI themed the iOS way: grey-filled fields, rounded-rect buttons with
 * 44 px targets, sheets with a grabber and a glass header, glass menus and
 * toasts, almost no shadows. The palettes behind the colour names are in
 * assets/css/main.css; the reasoning is in docs/design.md.
 */

// The fill every field shares: grey, borderless, an accent ring only while focused
const FIELD = 'bg-elevated ring-0 focus-visible:ring-2 focus-visible:ring-inset hover:bg-elevated disabled:bg-elevated'

// Glass for what floats over content (docs/design.md → Materials)
const GLASS = 'bg-glass backdrop-blur-glass backdrop-saturate-180'

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
      // Water — teal, so a glass never reads as protein's blue
      info: 'teal',
      neutral: 'graphite'
    },

    // tailwind-merge has to know the design's own sizes, radii and shadows, or
    // it takes `text-footnote` for a colour and drops `text-muted` beside it
    tv: {
      twMergeConfig: {
        extend: {
          theme: {
            text: ['large-title', 'title', 'title2', 'title3', 'headline', 'body', 'callout', 'subheadline', 'footnote', 'caption', 'caption2', 'hero', 'micro'],
            radius: ['card', 'tile', 'control', 'sheet'],
            shadow: ['card', 'raised', 'overlay', 'fab'],
            blur: ['glass'],
            ease: ['soft', 'spring'],
            font: ['rounded']
          }
        }
      }
    },

    // md is the 44 px default; xs and sm are for dense rows that are themselves the target.
    // Rounded rectangles, not pills; an icon-only button is a circle
    button: {
      slots: {
        base: 'rounded-control font-semibold transition-[color,background-color,box-shadow,opacity,transform] duration-120 ease-soft enabled:active:scale-[0.98] motion-reduce:enabled:active:scale-100'
      },
      variants: {
        size: {
          xs: { base: 'rounded-lg px-2.5 py-1 text-[0.8125rem]/5 gap-1' },
          sm: { base: 'rounded-lg px-3 py-1.5 text-subheadline/5 gap-1.5' },
          md: { base: 'px-4 py-3 text-subheadline/5 gap-2' },
          lg: { base: 'rounded-xl px-5 py-3.5 text-body/5 gap-2' },
          xl: { base: 'rounded-xl px-6 py-4.5 text-body/5 gap-2.5', leadingIcon: 'size-6', trailingIcon: 'size-6' }
        }
      },
      compoundVariants: [
        { size: 'xs', square: true, class: 'p-1.5' },
        { size: 'sm', square: true, class: 'p-2' },
        { size: 'md', square: true, class: 'p-3' },
        { size: 'lg', square: true, class: 'p-3.5' },
        { size: 'xl', square: true, class: 'p-4' },
        { square: true, class: 'rounded-full' }
      ]
    },

    input: {
      slots: { base: 'rounded-control' },
      variants: {
        variant: { outline: FIELD },
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
        variant: { outline: FIELD },
        size: {
          md: { base: 'px-3.5 py-3' },
          lg: { base: 'px-4 py-3.5' }
        }
      }
    },

    select: {
      slots: {
        base: 'rounded-control',
        content: 'z-50 rounded-xl ring-0 shadow-overlay',
        item: 'rounded-md'
      },
      variants: {
        variant: { outline: FIELD },
        size: {
          md: { base: 'px-3.5 py-3 text-base/5', item: 'p-2.5' },
          lg: { base: 'px-4 py-3.5 text-base/5', item: 'p-3' }
        }
      }
    },

    selectMenu: {
      slots: {
        base: 'rounded-control',
        content: 'z-50 rounded-xl ring-0 shadow-overlay'
      },
      variants: {
        variant: { outline: FIELD }
      }
    },

    formField: {
      slots: {
        label: 'text-subheadline font-medium text-default',
        description: 'text-footnote text-muted',
        hint: 'text-footnote text-muted',
        help: 'mt-1.5 text-footnote text-muted',
        error: 'mt-1.5 text-footnote text-error'
      }
    },

    // iOS's switch: 51 × 31, a white thumb, the accent when on
    switch: {
      slots: {
        thumb: 'bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.06)]'
      },
      variants: {
        size: {
          md: {
            base: 'w-[3.1875rem]',
            container: 'h-[1.9375rem]',
            thumb: 'size-[1.6875rem] data-[state=checked]:translate-x-5 data-[state=checked]:rtl:-translate-x-5',
            wrapper: 'text-subheadline'
          }
        }
      }
    },

    // UTabs, should a screen reach for it, is the same segmented control as ShellSegmented
    tabs: {
      variants: {
        variant: {
          pill: {
            list: 'bg-elevated rounded-[0.5625rem] p-0.5',
            trigger: 'rounded-[0.4375rem] text-[0.8125rem] font-semibold',
            indicator: 'rounded-[0.4375rem] bg-(--app-thumb) shadow-[0_3px_8px_rgb(0_0_0/0.12),0_1px_1px_rgb(0_0_0/0.04)]'
          }
        }
      }
    },

    // Bottom sheets: a grabber, a header that turns to glass as the body scrolls
    // under it, a footer pinned as glass at the bottom, a dimmed (not blurred)
    // page behind. The container is the sheet's scroller, so header and footer
    // are sticky inside it — a sheet that scrolls its body instead keeps them
    // plain. Everything that floats is z-50: above the nav bar (30) and the tab
    // bar (40), under the confirm dialog (60) and toasts (100)
    drawer: {
      slots: {
        overlay: 'z-50 bg-(--app-scrim)',
        content: 'app-sheet z-50 bg-default ring-0',
        handle: '!bg-(--app-grabber) !mt-1.5',
        container: 'gap-0 p-0 overscroll-contain',
        // shrink-0: in a scrolling flex column a header would otherwise be squeezed to its min-height
        header: 'app-sheet-header sticky top-0 z-10 shrink-0 px-4 pt-2.5 pb-3',
        title: 'text-headline text-highlighted',
        description: 'mt-0.5 text-subheadline text-muted',
        body: 'px-4 pt-1 pb-5',
        footer: 'app-sheet-footer sticky bottom-0 z-10 shrink-0 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]'
      },
      compoundVariants: [
        // iOS's grabber: 36 × 5
        { direction: ['top', 'bottom'], class: { handle: '!w-9 !h-[0.3125rem]' } },
        { direction: 'bottom', inset: false, class: { content: 'rounded-t-sheet' } }
      ]
    },

    modal: {
      slots: {
        overlay: 'z-50 bg-(--app-scrim)',
        content: 'z-50 divide-y-0',
        title: 'text-headline text-highlighted',
        description: 'mt-0.5 text-subheadline text-muted',
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
        overlay: 'z-50 bg-(--app-scrim)',
        content: 'z-50 ring-0 shadow-overlay',
        title: 'text-headline text-highlighted'
      }
    },

    // Menus are glass, like iOS's context menus
    dropdownMenu: {
      slots: {
        content: `z-50 min-w-52 rounded-[0.8125rem] ring-0 shadow-overlay ${GLASS}`,
        viewport: 'divide-separator',
        item: 'before:rounded-md data-highlighted:not-data-disabled:before:bg-accented',
        separator: 'bg-separator'
      },
      variants: {
        size: {
          md: { item: 'px-3 py-2.5 gap-3 text-subheadline', itemLeadingIcon: 'size-5' }
        }
      }
    },

    popover: {
      slots: {
        content: 'z-50 rounded-xl ring-0 shadow-overlay'
      }
    },

    tooltip: {
      slots: {
        content: 'z-50 rounded-lg'
      }
    },

    // A glass banner under the notch. The time left on a toast (the Undo
    // window) is a hint, not a headline, so its line stays faint
    toast: {
      slots: {
        root: `rounded-2xl ring-0 border border-(--app-glass-border) shadow-overlay p-3.5 ${GLASS}`,
        title: 'text-subheadline font-semibold',
        description: 'text-footnote text-muted',
        progress: 'opacity-40'
      }
    },

    card: {
      slots: {
        root: 'rounded-card ring-0 shadow-none bg-cell divide-separator'
      }
    },

    alert: {
      slots: {
        root: 'rounded-card',
        title: 'text-subheadline font-semibold',
        description: 'text-footnote opacity-90'
      }
    },

    skeleton: {
      base: 'rounded-md bg-elevated'
    },

    authForm: {
      slots: {
        root: 'space-y-8',
        header: 'text-left',
        title: 'text-large-title text-highlighted',
        description: 'mt-2 text-callout text-muted',
        footer: 'text-subheadline text-muted mt-2'
      }
    }
  }
})
