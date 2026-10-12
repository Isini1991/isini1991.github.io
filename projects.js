/*
  PROJECT DATA. Edit this file to change the work shown on the site.

  These are Esi's real projects. Text was written from each live site.
  Screenshots live in images/ (<slug>-desktop.webp and <slug>-mobile.webp).
  Still to fill in: year for every project, the Amen Road details, and a better
  cover for Brent Foster (its hero video failed to load).

  Fields
    title     Project name
    client    Who it was for
    year      Year it launched (leave "" to hide)
    medium    Like a gallery wall label: the tools and disciplines involved
    summary   One or two sentences about the work
    url       Live link, or "#" if there is none
    video     Optional muted motion clip (e.g. "media/web/clip.mp4"), or a list
              of clips that play one after another. Plays on its own while the
              card is on screen; "image" becomes its poster.
    embed     true = on desktop, the gallery card runs the real site live (scaled
              down) while it is in view. Only works for sites that allow framing.
    interactive  true = visitors can move the mouse inside that live card
              (for sites that react to the cursor).
    live      true = show a "Try it live" button that opens the real site in a
              window on the page (desktop only, hidden in the framed preview).
    image     Path to a cover image (e.g. "images/halde.jpg"). Leave "" to use
              the generated cover made from colors + shape below.
    colors    Two colors for the generated cover [background, shape]
    shape     Generated cover shape: "orb" | "arch" | "stripes" | "dots" | "split"
    featured  true = also shown in the large horizontal gallery (pick 4 to 6)
*/
window.PROJECTS = [
  {
    title: "False Gods",
    client: "Band, Long Island, New York",
    year: "",
    medium: "Band site, releases, live archive",
    summary: "A dark, quiet home for a band's music and live archive, with releases linked straight to Bandcamp.",
    url: "https://isini1991.github.io/false-gods-preview/",
    video: "",
    embed: true,
    interactive: true,
    live: true,
    image: "media/web/false-gods-poster.webp",
    colors: ["#101010", "#F2F2F2"],
    shape: "split",
    featured: true
  },
  {
    title: "DJ Lofi",
    client: "DJ and record curator, Portland",
    year: "",
    medium: "Explorable 3D room, audio player",
    summary: "A lamp-lit listening room you can explore: the turntable plays records, the shelf holds the collection, and the notebook links to his writing and radio shows.",
    url: "https://isini1991.github.io/dj-lofi-preview/",
    video: "",
    embed: true,
    interactive: false,
    live: true,
    image: "media/web/dj-lofi-poster.webp",
    colors: ["#3A2416", "#E0A55B"],
    shape: "orb",
    featured: true
  },
  {
    title: "Oráculo Records",
    client: "Independent electronic label, Spain",
    year: "",
    medium: "Label site, 3D record, catalogue",
    summary: "A catalogue for a darkwave and EBM label that releases physical records for collectors, built around a rotating record and bold condensed type.",
    url: "https://isini1991.github.io/oraculo/",
    video: "",
    embed: false,
    interactive: false,
    live: true,
    image: "media/web/oraculo-poster.webp",
    colors: ["#E8E5DC", "#151515"],
    shape: "orb",
    featured: false
  },
  {
    title: "Faih Bitrou",
    client: "Wedding photographer, Santorini and Athens",
    year: "",
    medium: "Portfolio, intro sequence, hold-to-focus gallery",
    summary: "A soft, dreamy portfolio that opens like a memory coming into focus. Visitors hold a photo to bring it into focus.",
    url: "https://isini1991.github.io/faih-bitrou/",
    video: "",
    embed: false,
    interactive: false,
    live: true,
    image: "media/web/faih-bitrou-poster.webp",
    colors: ["#F7F3EC", "#3E7CA8"],
    shape: "arch",
    featured: false
  },
  {
    title: "Sina Golnoghreh",
    client: "Bassist, composer and sound engineer",
    year: "",
    medium: "Bilingual site, career timeline, gallery",
    summary: "A dark, minimal site in Persian and English that maps a musician's career, bands and releases on one scrolling timeline.",
    url: "https://www.sinawings.com/",
    video: "",
    embed: true,
    interactive: false,
    live: true,
    image: "media/web/sinawings-hero-poster.webp",
    colors: ["#0B0B0B", "#C9A86A"],
    shape: "stripes",
    featured: true
  },
  {
    title: "boy",
    client: "Independent music project of Adam Leach",
    year: "",
    medium: "Listening room, record shelf, shuffle",
    summary: "A playful listening room for a one-person band: a shelf of 23 records, a shuffle button and a Bandcamp player that loads only when asked.",
    url: "https://learnwithregrets.com/",
    video: "",
    embed: false,
    interactive: false,
    live: true,
    image: "images/learnwithregrets-desktop.webp",
    colors: ["#EDE9E0", "#1E1E1E"],
    shape: "dots",
    featured: false
  },
  {
    title: "Matthew Joseph",
    client: "Advertising photographer and director, London",
    year: "",
    medium: "Portfolio, filtered work, video reels",
    summary: "A cinematic portfolio for a photographer and director, with work filtered by sport, lifestyle, technology and motion.",
    url: "https://www.matthewjoseph.co.uk/",
    video: "",
    embed: true,
    interactive: false,
    live: true,
    image: "media/web/matthewjoseph-poster.webp",
    colors: ["#1C1C1C", "#D8D2C8"],
    shape: "arch",
    featured: true
  },
  {
    title: "Tristan Bejawn",
    client: "Photographer and director of photography, London",
    year: "",
    medium: "Portfolio, documentary series, motion",
    summary: "A portfolio for portrait, documentary and commercial work, with room for long travel series and film photography.",
    url: "https://www.tristanbejawn.com/",
    video: "",
    embed: true,
    interactive: true,
    live: true,
    image: "media/web/tristanbejawn-poster.webp",
    colors: ["#D9D6D0", "#2B2B2B"],
    shape: "stripes",
    featured: true
  },
  {
    title: "Brent Foster",
    client: "Commercial and documentary film director",
    year: "",
    medium: "Director's site, film library, stills",
    summary: "An image-led site for a director whose films pair surreal visuals with real human performances.",
    url: "https://www.brentfoster.com/",
    video: "",
    embed: false,
    interactive: false,
    live: false,
    image: "",
    colors: ["#2D3B3A", "#E3B98F"],
    shape: "orb",
    featured: false
  },
  {
    title: "Amen Road",
    client: "Client details to add",
    year: "",
    medium: "Website",
    summary: "Description to add.",
    url: "https://www.amenroad.com/",
    video: "",
    embed: false,
    interactive: false,
    live: false,
    image: "",
    colors: ["#5A4632", "#E9DCC6"],
    shape: "dots",
    featured: false
  },
  {
    title: "The Monolith Project",
    client: "Immersive 3D experience",
    year: "",
    medium: "WebGL world, custom shaders, 3D",
    summary: "A browser-based 3D journey where a silent monolith wakes across the stars. Hand-drawn 2D illustrations by Zao Yu Lin, rebuilt as 3D scenes with custom shaders.",
    url: "https://themonolithproject.net/",
    video: "",
    embed: true,
    interactive: false,
    live: true,
    image: "media/web/themonolithproject-scene-poster.webp",
    colors: ["#1B1F3A", "#F0C987"],
    shape: "orb",
    featured: true
  },
  {
    title: "Nude Club Records",
    client: "Independent record label",
    year: "",
    medium: "Label site, catalogue, store",
    summary: "A text-led home for the label behind releases from Boy Harsher, Safe Mind and Special Interest, with full pressing and vinyl-variant notes for collectors.",
    url: "https://nudeclubrecords.com/",
    video: "",
    embed: false,
    interactive: false,
    live: true,
    image: "images/nudeclubrecords-desktop.webp",
    colors: ["#141414", "#E6E1DA"],
    shape: "split",
    featured: false
  },
  {
    title: "instinkt lab",
    client: "Electronic music platform and label, Cologne and Berlin",
    year: "",
    medium: "Label site, catalogue, artist roster",
    summary: "An artist-driven label and platform with a catalogue across vinyl, cassette, dubplate and digital, plus its roster of producers, DJs and live acts.",
    url: "https://instinktlab.eu/",
    video: "",
    embed: false,
    interactive: false,
    live: true,
    image: "images/instinktlab-desktop.webp",
    colors: ["#1A1A1A", "#9AA3AD"],
    shape: "stripes",
    featured: false
  },
  {
    title: "Dais Records",
    client: "Independent record label",
    year: "",
    medium: "Label site, shop, dark and light modes",
    summary: "A full shop and archive for a label releasing post-punk, darkwave, shoegaze and ambient records since 2007, with artist pages, tours and news.",
    url: "https://daisrecords.com/",
    video: "",
    embed: false,
    interactive: false,
    live: false,
    image: "images/daisrecords-desktop.webp",
    colors: ["#F9F9F9", "#111111"],
    shape: "dots",
    featured: false
  },
  {
    title: "Origins Inconclusive",
    client: "Record label, publisher and creative house, London",
    year: "",
    medium: "Editorial site, catalogue, journal",
    summary: "An editorial, image-led site for a London label and publisher, with large artwork, artist portraits, a journal and a scrolling text banner.",
    url: "https://originsinconclusive.com/",
    video: "",
    embed: false,
    interactive: false,
    live: true,
    image: "images/originsinconclusive-desktop.webp",
    colors: ["#E8E3DA", "#2E2A26"],
    shape: "arch",
    featured: false
  },
  {
    title: "VIGOR",
    client: "Producer, beatmaker and rapper, Ankara",
    year: "",
    medium: "Artist site, track player",
    summary: "A dark, gothic site for a producer selling beats and production, built around a monolith image and bands of ASCII-style symbols.",
    url: "https://vigorvigorous.com/",
    video: "",
    embed: false,
    interactive: false,
    live: false,
    image: "media/web/vigorvigorous-poster.webp",
    colors: ["#0A0A0A", "#7A7A7A"],
    shape: "arch",
    featured: true
  }
];
