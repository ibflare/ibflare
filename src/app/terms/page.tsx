import Link from "next/link";
import { LegalPage, LegalAddress } from "@/components/LegalPage";

export const metadata = {
  title: "Terms of Service",
  description:
    "The terms for using FLARE. Nothing on the site is financial, investment, tax, accounting, or legal advice.",
};

const MAIL = "mailto:ibflarergv@gmail.com";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="August 29, 2026">
      <p>
        These terms govern your use of FLARE, a video library operated by the
        FLARE student organization at Lamar Academy in McAllen, Texas. By
        creating an account you agree to them.
      </p>
      <p>
        Questions:{" "}
        <strong>
          <a href={MAIL}>ibflarergv@gmail.com</a>
        </strong>
        .
      </p>

      <hr />

      <h2>1. Who can use FLARE</h2>
      <p>
        You must be 13 or older to create an account. Accounts are for
        individuals. Do not share your account or sign in as someone else.
      </p>
      <p>
        We may decline to create an account, or close one, at our discretion.
      </p>

      <hr />

      <h2>2. What FLARE is, and what it is not</h2>
      <p>
        FLARE publishes educational videos made by students and other
        contributors about personal finance, taxes, and economics.
      </p>
      <p>
        <strong>
          Nothing on this site is financial, investment, tax, accounting, or
          legal advice.
        </strong>{" "}
        Nothing here is a recommendation to buy, sell, or hold any security or
        financial product. Contributors are students and volunteers, not
        licensed professionals, and videos may contain errors or become out of
        date. Talk to a qualified professional before acting on anything you see
        here.
      </p>
      <p>
        FLARE accepts no sponsorship, affiliate compensation, or referral
        payments in exchange for content, and no contributor is paid for what
        they publish.
      </p>

      <hr />

      <h2>3. Your account</h2>
      <p>
        Keep your sign-in credentials to yourself. Tell us at{" "}
        <a href={MAIL}>ibflarergv@gmail.com</a> if you think someone else has
        access to your account.
      </p>
      <p>
        Your username is public and permanent once chosen. Your display name,
        bio, and picture are public. Your grade, school, city, and email address
        are not public. See the <Link href="/privacy">Privacy Policy</Link> for
        detail.
      </p>

      <hr />

      <h2>4. Publishing videos</h2>
      <p>
        Publishing requires permission from a FLARE officer or the faculty
        sponsor. Having an account does not by itself allow you to publish.
      </p>
      <p>When you publish, you confirm that:</p>
      <ul>
        <li>
          The video is your own work, or you have permission from whoever made
          it.
        </li>
        <li>
          Everyone who appears or speaks in the video has agreed to it being
          posted, and for anyone under 18 a signed media release is on file with
          FLARE.
        </li>
        <li>
          You have named your sources in the video where you relied on them.
        </li>
        <li>
          The video does not contain material that belongs to someone else,
          including music, footage, or images you do not have the right to use.
        </li>
        <li>
          The video is explaining how something works, not recommending a
          product, service, or investment.
        </li>
        <li>
          The video contains no sponsorship, affiliate link, or referral code.
        </li>
      </ul>
      <p>
        You keep ownership of what you publish. By publishing on FLARE you give
        us permission to display it on the site, describe it, and keep it in the
        library, including after you leave the organization. You can ask us to
        take something down and we will.
      </p>
      <p>
        Tagging a collaborator sends them a request. They appear as a co-author
        only if they accept.
      </p>

      <hr />

      <h2>5. Comments and conduct</h2>
      <p>Do not post anything that is:</p>
      <ul>
        <li>abusive, harassing, or threatening</li>
        <li>
          a slur, or an attack on someone&rsquo;s race, religion, sex,
          orientation, disability, or national origin
        </li>
        <li>sexual content</li>
        <li>spam, advertising, or a referral link</li>
        <li>someone else&rsquo;s private information</li>
        <li>
          deliberately false in a way that could cause someone financial harm
        </li>
      </ul>
      <p>
        Comments are filtered automatically for some language, but the filter is
        not the main safeguard. Every account is tied to a real person, and
        officers and the faculty sponsor can identify who posted what.
      </p>

      <hr />

      <h2>6. Moderation</h2>
      <p>
        Officers and the faculty sponsor may edit or remove any video or
        comment, and may suspend an account. A suspended account can still watch
        but cannot publish, comment, or edit anything.
      </p>
      <p>
        Because FLARE operates at Lamar Academy, conduct on this site may also
        be addressed through the school&rsquo;s normal disciplinary process.
      </p>
      <p>
        If you think a moderation decision was wrong, email{" "}
        <a href={MAIL}>ibflarergv@gmail.com</a> and it will be reviewed by the
        faculty sponsor.
      </p>

      <hr />

      <h2>7. Availability</h2>
      <p>
        FLARE is run by students and is provided as is, with no guarantee that
        it will be available, accurate, or free of errors. We may change or
        discontinue any part of it at any time.
      </p>
      <p>
        Videos are hosted on YouTube and played through an embedded YouTube
        player. YouTube&rsquo;s own terms and privacy policy apply to playback,
        and we do not control whether a video remains available there.
      </p>

      <hr />

      <h2>8. Limits</h2>
      <p>
        To the fullest extent the law allows, FLARE, its members, its faculty
        sponsor, and Lamar Academy are not liable for any loss arising from your
        use of this site or from anything published on it, including financial
        decisions made on the basis of a video.
      </p>

      <hr />

      <h2>9. Ending your use</h2>
      <p>
        You can ask us to delete your account at any time by emailing{" "}
        <a href={MAIL}>ibflarergv@gmail.com</a>. We may suspend or close an
        account that breaks these terms.
      </p>
      <p>
        Videos already published may remain in the library after an account
        closes, unless you ask us to take them down.
      </p>

      <hr />

      <h2>10. Changes</h2>
      <p>
        We may update these terms. If a change is significant, we will update
        the date above and notify account holders. Continuing to use the site
        after a change means you accept the updated terms.
      </p>

      <hr />

      <h2>11. Governing law</h2>
      <p>
        These terms are governed by the laws of the State of Texas.
      </p>

      <hr />

      <h2>Contact</h2>
      <LegalAddress />
    </LegalPage>
  );
}
