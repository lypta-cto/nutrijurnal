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

// A note on any surface: the grey fill, no ring, the ordinary text colour
const NOTE = 'bg-elevated text-default ring-0'

// Nuxt UI shrinks a field's text from 768 px up (a desktop form); the diary is
// one phone-width column everywhere, so a field keeps its phone size
const SAME_SIZE_EVERYWHERE = [
  { fixed: false, size: ['xs', 'sm'] as ('xs' | 'sm')[], class: 'md:text-sm' },
  { fixed: false, size: ['md', 'lg', 'xl'] as ('md' | 'lg' | 'xl')[], class: 'md:text-base' }
]

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
        ...SAME_SIZE_EVERYWHERE,
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
      },
      compoundVariants: SAME_SIZE_EVERYWHERE
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
      },
      compoundVariants: SAME_SIZE_EVERYWHERE
    },

    selectMenu: {
      slots: {
        base: 'rounded-control',
        content: 'z-50 rounded-xl ring-0 shadow-overlay'
      },
      variants: {
        variant: { outline: FIELD }
      },
      compoundVariants: SAME_SIZE_EVERYWHERE
    },

    // No red asterisk: every field on the forms that mark one is required, so
    // it says nothing — and a missing value is named under the field anyway
    formField: {
      slots: {
        label: 'text-subheadline font-medium text-default',
        description: 'text-footnote text-muted',
        hint: 'text-footnote text-muted',
        help: 'mt-1.5 text-footnote text-muted',
        error: 'mt-1.5 text-footnote text-error'
      },
      variants: {
        required: {
          true: { label: 'after:content-none' }
        }
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

    // A checkbox picks rows out of a list, so it is iOS's selection circle: a
    // grey ring when off, the accent filled with a white tick when on
    checkbox: {
      slots: {
        base: 'rounded-full ring-[1.5px] ring-(--ui-text-dimmed)',
        icon: 'size-3.5'
      },
      variants: {
        size: {
          md: { base: 'size-[1.375rem]', container: 'h-[1.375rem]' }
        }
      }
    },

    // iOS's slider: a thin grey track, the accent up to a white thumb with a
    // soft shadow — the switch's thumb, not a ringed dot
    slider: {
      slots: {
        thumb: 'bg-white ring-0 shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16),0_0_0_0.5px_rgb(0_0_0/0.04)]'
      },
      variants: {
        size: {
          md: { thumb: 'size-7' }
        }
      },
      compoundVariants: [
        { orientation: 'horizontal', size: 'md', class: { track: 'h-1' } }
      ]
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

    // Menus are iOS's context menus: glass, rows edge to edge in body type
    // with hairlines between them, the glyph after the words, and a band of
    // shade (not a line) between groups
    dropdownMenu: {
      slots: {
        content: `z-50 min-w-60 rounded-[0.8125rem] ring-0 shadow-overlay ${GLASS}`,
        viewport: 'divide-y-[0.5rem] divide-(--app-menu-gap)',
        group: 'p-0',
        item: 'not-first:shadow-[inset_0_var(--app-hairline)_0_0_var(--app-separator)] before:inset-0 before:rounded-none data-highlighted:not-data-disabled:before:bg-accented',
        itemLeadingIcon: 'order-last ms-auto',
        separator: 'mx-0 my-0 h-2 bg-(--app-menu-gap)'
      },
      variants: {
        active: {
          false: { itemLeadingIcon: 'text-default group-data-highlighted:text-default' }
        },
        size: {
          md: { item: 'px-4 py-[0.6875rem] gap-3 text-body', itemLeadingIcon: 'size-5' }
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

    // A glass banner under the notch. Its action (Undo) is accent text lined
    // up with the words, as iOS sets a banner's button. The time left (the
    // Undo window) is a hint, not a headline: a 2 px line with no track
    toast: {
      slots: {
        root: `rounded-[1.375rem] ring-0 border-[length:var(--app-hairline)] border-(--app-glass-border) shadow-overlay p-3.5 ${GLASS}`,
        title: 'text-subheadline font-semibold',
        description: 'text-footnote text-muted',
        progress: 'opacity-35 [&_[data-slot=base]]:h-0.5 [&_[data-slot=base]]:bg-transparent'
      },
      variants: {
        orientation: {
          vertical: { actions: '-ms-2 mt-1' }
        }
      }
    },

    card: {
      slots: {
        root: 'rounded-card ring-0 shadow-none bg-cell divide-separator'
      }
    },

    // An alert is a note, not a coloured box: a grey well, the text in the
    // ordinary colours, and only the glyph (and an error's title) in the
    // colour that says why
    alert: {
      slots: {
        root: 'rounded-card',
        title: 'text-subheadline font-semibold',
        description: 'text-footnote opacity-90'
      },
      compoundVariants: [
        { color: 'primary', variant: ['soft', 'subtle'], class: { root: NOTE, description: 'text-muted', icon: 'text-primary' } },
        { color: 'success', variant: ['soft', 'subtle'], class: { root: NOTE, description: 'text-muted', icon: 'text-success' } },
        { color: 'info', variant: ['soft', 'subtle'], class: { root: NOTE, description: 'text-muted', icon: 'text-info' } },
        { color: 'warning', variant: ['soft', 'subtle'], class: { root: NOTE, description: 'text-muted', icon: 'text-warning' } },
        { color: 'error', variant: ['soft', 'subtle'], class: { root: NOTE, description: 'text-muted', icon: 'text-error', title: 'text-error' } },
        { color: 'neutral', variant: ['soft', 'subtle'], class: { root: NOTE, description: 'text-muted', icon: 'text-muted' } }
      ]
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
