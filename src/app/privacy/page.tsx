import {
  LegalPage,
  LegalAddress,
  LegalTable,
} from "@/components/LegalPage";

export const metadata = {
  title: "Privacy Policy",
  description:
    "What FLARE collects, why, and who can see it. Grade, school, and city are never shown publicly.",
};

const MAIL = "mailto:ibflarergv@gmail.com";

export default function PrivacyPage() {
  return (
    // Date bumped when viewing stopped requiring an account, which moved both
    // rows of the "who can see what" table from "anyone with an account" to
    // anyone at all. The policy's own Changes section says a change to who can
    // see what gets a new date. The previous bump was 30 August, when profile
    // pages briefly moved behind sign-in.
    <LegalPage title="Privacy Policy" updated="September 3, 2026">
      <p>
        FLARE (Financial Literacy Advancement for RGV Equity) is a student
        organization at Lamar Academy in McAllen, Texas. This policy explains
        what information we collect when you use flare.example.org, why we
        collect it, and what we do with it.
      </p>
      <p>
        If you have a question about anything here, email us at{" "}
        <strong>
          <a href={MAIL}>ibflarergv@gmail.com</a>
        </strong>
        .
      </p>

      <hr />

      <h2>Who this site is for</h2>
      <p>
        You must be 13 or older to create an account. We ask for your birth
        month and year when you first sign in, and we do not create an account
        for anyone under 13.
      </p>
      <p>
        If you believe someone under 13 has created an account, email{" "}
        <strong>
          <a href={MAIL}>ibflarergv@gmail.com</a>
        </strong>{" "}
        and we will delete it and any information associated with it.
      </p>

      <hr />

      <h2>What we collect</h2>

      <h3>When you create an account</h3>
      <p>
        If you sign in with Google, Google provides us with your email address,
        your name, and your profile picture. We do not receive your Google
        password and we cannot see it.
      </p>
      <p>
        If you sign in with an email address and password, we store your email
        address. Your password is handled by our authentication provider and is
        stored only as a cryptographic hash. We never see it.
      </p>

      <h3>When you complete your profile</h3>
      <ul>
        <li>
          <strong>Username and display name.</strong> These are public. We
          suggest using a first name and last initial.
        </li>
        <li>
          <strong>Bio and profile picture.</strong> Optional, and public if you
          provide them.
        </li>
        <li>
          <strong>Grade, school, and city.</strong> These are private. They are
          visible only to FLARE officers and the faculty sponsor. They are never
          shown on a public page.
        </li>
        <li>
          <strong>Birth year.</strong> We store the year only, not your full
          date of birth. We use it once, to confirm you are old enough to have
          an account.
        </li>
        <li>
          <strong>The date you accepted these terms.</strong>
        </li>
      </ul>

      <h3>When you publish a video</h3>
      <p>
        The title, description, difficulty level, topic, and YouTube link you
        submit, along with your account as the author and any collaborators you
        tag. All of this is public.
      </p>

      <h3>When you comment</h3>
      <p>
        Your comment text and your account as the author. Comments are public.
      </p>

      <h3>Automatically</h3>
      <p>
        We keep an internal log of moderation actions, including who deleted a
        video or comment, who changed someone&rsquo;s permissions, and when.
        This log is visible only to officers and the faculty sponsor.
      </p>
      <p>
        We do not use advertising trackers, and we do not sell or rent any
        information about you.
      </p>

      <hr />

      <h2>Video playback and YouTube</h2>
      <p>
        Videos on FLARE are hosted on YouTube and played through an embedded
        YouTube player. We use YouTube&rsquo;s privacy-enhanced mode, which
        reduces the data YouTube collects before you press play, but once you
        start a video YouTube receives information about your device and
        viewing.
      </p>
      <p>
        That data goes to Google, not to us, and is governed by Google&rsquo;s
        own privacy policy at{" "}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          policies.google.com/privacy
        </a>
        . We have no access to it and no control over it.
      </p>

      <hr />

      <h2>Who can see what</h2>
      <LegalTable>
        <table>
          <thead>
            <tr>
              <th>Information</th>
              <th>Who can see it</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Username, display name, title, bio, profile picture</td>
              <td>Anyone, including people without an account</td>
            </tr>
            <tr>
              <td>Videos you publish and comments you post</td>
              <td>Anyone, including people without an account</td>
            </tr>
            <tr>
              <td>Email address</td>
              <td>You, officers, and the faculty sponsor</td>
            </tr>
            <tr>
              <td>Grade, school, city, birth year</td>
              <td>You, officers, and the faculty sponsor</td>
            </tr>
            <tr>
              <td>Moderation log</td>
              <td>Officers and the faculty sponsor</td>
            </tr>
          </tbody>
        </table>
      </LegalTable>

      <hr />

      <h2>Services we use</h2>
      <ul>
        <li>
          <strong>Supabase</strong> stores our database and handles sign-in.
          Data is stored in the United States.
        </li>
        <li>
          <strong>Google</strong> provides sign-in and hosts the videos through
          YouTube.
        </li>
        <li>
          <strong>Our hosting provider</strong> serves the site and processes
          ordinary web requests.
        </li>
      </ul>
      <p>
        Each of these companies has its own privacy policy governing what it
        does with the information it handles.
      </p>

      <hr />

      <h2>How long we keep things</h2>
      <p>
        We keep your account and its information for as long as your account
        exists.
      </p>
      <p>
        Videos and comments you publish stay on the site after you leave FLARE,
        because the library is meant to be useful to people who arrive later. If
        you want something you published taken down, ask us and we will take it
        down.
      </p>
      <p>
        Moderation logs are kept indefinitely so that officers and sponsors can
        review past decisions.
      </p>

      <hr />

      <h2>Your choices</h2>
      <p>
        You can edit your display name, bio, picture, grade, school, and city at
        any time from your profile. Your username cannot be changed after you
        choose it, because it is part of the link to your profile.
      </p>
      <p>
        Email{" "}
        <strong>
          <a href={MAIL}>ibflarergv@gmail.com</a>
        </strong>{" "}
        to:
      </p>
      <ul>
        <li>get a copy of the information we hold about you</li>
        <li>correct something that is wrong</li>
        <li>delete your account</li>
        <li>take down a video or comment you published</li>
      </ul>
      <p>
        We will respond within 30 days. If you are under 18, a parent or
        guardian may make any of these requests on your behalf.
      </p>

      <hr />

      <h2>Security</h2>
      <p>
        Access to private information is limited by database permissions rather
        than by policy alone. Grade, school, and city are not present in any
        public view of the site, so they cannot be exposed by an ordinary page
        or query.
      </p>
      <p>
        No system is perfectly secure. If we learn of a breach affecting your
        information, we will notify affected accounts and, where the law
        requires it, the appropriate authorities.
      </p>

      <hr />

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that affects what we collect or who
        can see it, we will update the date at the top and notify account
        holders. Continuing to use the site after a change means you accept the
        updated policy.
      </p>

      <hr />

      <h2>Contact</h2>
      <LegalAddress />
    </LegalPage>
  );
}
