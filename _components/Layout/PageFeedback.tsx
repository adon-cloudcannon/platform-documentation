import type { Helpers } from "../../_types.d.ts";

interface Props {
  url: string;
  helpers: Helpers;
}

/**
 * "Was this page useful?" widget.
 *
 * Two visual states:
 *   - Collapsed (default): a small rounded tab sticking in from the right
 *     edge of the viewport, near the bottom. Icon reflects current rating —
 *     unfilled thumbs when no rating, filled thumb (up/down) if the user
 *     has already picked one this session.
 *   - Expanded: a full form panel with close (×), thumb rating, comment
 *     textarea, and submit.
 *
 * Also avoids overlapping the footer via `footerOverlap` scroll listener —
 * as the footer enters the viewport, the widget rises with it.
 *
 * Submits to a CloudCannon Form (placeholder action; wire it up when ready).
 * Hidden inputs: rating, page_url, and a `_gotcha` honeypot.
 */
export default function PageFeedback({ url, helpers }: Props) {
  return (
    <form
      className="c-feedback"
      action="/forms/page-feedback"
      method="POST"
      x-data={`{
        open: false,
        rating: '',
        expanded: false,
        footerOverlap: 0,
        toggleRating(value) {
          if (this.rating === value) {
            this.rating = '';
            this.expanded = false;
          } else {
            this.rating = value;
            this.expanded = true;
          }
        },
        updateOffset() {
          const footer = document.querySelector('.l-footer');
          if (!footer) return;
          const top = footer.getBoundingClientRect().top;
          this.footerOverlap = Math.max(0, window.innerHeight - top);
        },
      }`}
      x-init="updateOffset(); window.addEventListener('scroll', () => updateOffset(), { passive: true }); window.addEventListener('resize', () => updateOffset())"
      x-bind:class="{ 'c-feedback--collapsed': !open, 'c-feedback--rated-up': rating === 'up', 'c-feedback--rated-down': rating === 'down' }"
      x-bind:style="'bottom: ' + (20 + footerOverlap) + 'px'"
    >
      {/* Collapsed tab — rounded pill sticking in from the right edge.
          Shows thumb_up:outlined by default (matching the panel's thumb-up
          button). If the user rated down this session, the icon swaps to
          thumb_down:outlined. When either rating is set, the tab gains the
          same blue-background active treatment as the panel thumbs. */}
      <button
        type="button"
        className="c-feedback__tab"
        x-show="!open"
        x-cloak
        x-on:click="open = true"
        aria-label="Open page feedback"
        title="Was this page useful?"
      >
        <img
          className="c-feedback__tab-icon c-feedback__tab-icon--up"
          src={helpers.icon("thumb_up:outlined", "material")}
          alt=""
          aria-hidden="true"
          inline="true"
        />
        <img
          className="c-feedback__tab-icon c-feedback__tab-icon--down"
          src={helpers.icon("thumb_down:outlined", "material")}
          alt=""
          aria-hidden="true"
          inline="true"
        />
      </button>

      {/* Expanded panel */}
      <div className="c-feedback__panel" x-show="open" x-cloak>
        <button
          type="button"
          className="c-feedback__close"
          x-on:click="open = false"
          aria-label="Close feedback form"
        >
          <img
            src={helpers.icon("close:outlined", "material")}
            alt=""
            aria-hidden="true"
            inline="true"
          />
        </button>

        <p className="c-feedback__question">Was this page useful?</p>

        <div
          className="c-feedback__thumbs"
          role="radiogroup"
          aria-label="Rate this page"
        >
          <button
            type="button"
            className="c-feedback__thumb"
            x-bind:class="{ 'c-feedback__thumb--active': rating === 'up' }"
            x-bind:aria-pressed="rating === 'up'"
            x-on:click="toggleRating('up')"
            aria-label="Yes, useful"
          >
            <img
              src={helpers.icon("thumb_up:outlined", "material")}
              alt=""
              aria-hidden="true"
              inline="true"
            />
          </button>
          <button
            type="button"
            className="c-feedback__thumb"
            x-bind:class="{ 'c-feedback__thumb--active': rating === 'down' }"
            x-bind:aria-pressed="rating === 'down'"
            x-on:click="toggleRating('down')"
            aria-label="No, not useful"
          >
            <img
              src={helpers.icon("thumb_down:outlined", "material")}
              alt=""
              aria-hidden="true"
              inline="true"
            />
          </button>
        </div>

        <div className="c-feedback__form" x-show="expanded" x-cloak>
          <label htmlFor="c-feedback__comment" className="c-feedback__label">
            Tell us more{" "}
            <span className="c-feedback__label-note">(optional)</span>
          </label>
          <textarea
            id="c-feedback__comment"
            name="comment"
            className="c-feedback__comment"
            rows={3}
          />
          <div className="c-feedback__actions">
            <button
              type="button"
              className="c-feedback__cancel"
              x-on:click="rating = ''; expanded = false"
            >
              Cancel
            </button>
            <button type="submit" className="c-feedback__submit">
              Submit
            </button>
          </div>
        </div>
      </div>

      {/* Hidden inputs always present so the form is submittable from any
          state — regardless of whether the panel is open or collapsed. */}
      <input type="hidden" name="rating" x-bind:value="rating" />
      <input type="hidden" name="page_url" value={url} />

      {/* Honeypot for spam bots. Off-screen via sr-only pattern (not
          display:none, which some bots specifically skip). Humans never
          see it or tab into it; if a bot fills it, CloudCannon rejects
          the submission. */}
      <label className="c-feedback__gotcha" aria-hidden="true">
        Don't fill this out if you're human:
        <input
          type="text"
          name="_gotcha"
          tabIndex={-1}
          autoComplete="off"
        />
      </label>
    </form>
  );
}
