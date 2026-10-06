// Generates presets/presets.json from the compact data below: npm run build-presets
const fs = require('fs');
const path = require('path');

const niches = [
  {
    id: 'restaurant', label: 'Restaurant', name: "Luigi's Trattoria", domain: 'luigis-trattoria.com',
    tagline: 'Authentic Italian cooking since 1987', query: 'italian restaurant food',
    servicesSlug: 'menu', servicesTitle: 'Menu',
    features: [['Handmade Pasta', 'Rolled fresh every morning in our kitchen.'], ['Wood-Fired Pizza', 'Baked at 450°C in our brick oven.'], ['Local Wines', 'A curated cellar of regional favourites.']],
    services: [['Antipasti', 'Bruschetta, burrata and cured meats to share.'], ['Primi', 'Fresh pasta with seasonal sauces.'], ['Secondi', 'Grilled fish, slow-cooked meats and more.'], ['Dolci', 'Tiramisu, panna cotta and gelato.']],
    cta: 'Book a table tonight', about: 'A family kitchen in the heart of the city, serving recipes passed down for three generations.',
  },
  {
    id: 'coffee', label: 'Coffee Shop', name: 'Bean & Bloom', domain: 'beanandbloom.coffee',
    tagline: 'Small-batch roasts, big-hearted mornings', query: 'coffee shop latte',
    servicesSlug: 'menu', servicesTitle: 'Menu',
    features: [['Roasted In-House', 'Beans roasted weekly in small batches.'], ['Fresh Pastries', 'Baked every morning by our pastry team.'], ['Cozy Space', 'Free Wi-Fi, warm light and comfy chairs.']],
    services: [['Espresso Bar', 'Espresso, cortado, flat white and more.'], ['Filter & Pour-Over', 'Single origins brewed by hand.'], ['Cold Drinks', 'Cold brew, iced lattes and lemonades.'], ['Bakery', 'Croissants, cookies and banana bread.']],
    cta: 'Come say hi', about: 'We started with one espresso machine and a love for good mornings. Today we roast our own beans and still greet every guest by name.',
  },
  {
    id: 'gym', label: 'Fitness Gym', name: 'IronPulse Fitness', domain: 'ironpulse.fit',
    tagline: 'Stronger every single day', query: 'gym fitness workout',
    servicesSlug: 'classes', servicesTitle: 'Classes',
    features: [['Open 24/7', 'Train on your schedule, any hour.'], ['Expert Coaches', 'Certified trainers ready to help.'], ['Modern Equipment', 'Free weights, machines and turf.']],
    services: [['HIIT', 'High-intensity sessions to burn and build.'], ['Strength', 'Barbell programs for every level.'], ['Spin', 'Music-driven indoor cycling.'], ['Personal Training', 'One-on-one coaching tailored to you.']],
    cta: 'Claim your free trial week', about: 'IronPulse was built by coaches who believe fitness should feel welcoming, motivating and fun for everyone.',
  },
  {
    id: 'dental', label: 'Dental Clinic', name: 'BrightSmile Dental', domain: 'brightsmile-dental.com',
    tagline: 'Gentle care for healthy smiles', query: 'dentist clinic smile',
    servicesSlug: 'services', servicesTitle: 'Services',
    features: [['Gentle Care', 'Comfort-first treatment for nervous patients.'], ['Modern Tech', 'Digital X-rays and same-day crowns.'], ['Family Friendly', 'Care for kids, parents and grandparents.']],
    services: [['Check-ups & Cleaning', 'Routine exams to keep your smile healthy.'], ['Whitening', 'Professional whitening for a brighter smile.'], ['Implants', 'Long-lasting replacements for missing teeth.'], ['Orthodontics', 'Clear aligners and braces for all ages.']],
    cta: 'Book your check-up', about: 'Our team of dentists and hygienists has cared for local families for over 15 years.',
  },
  {
    id: 'law', label: 'Law Firm', name: 'Harper & Cole Law', domain: 'harpercole-law.com',
    tagline: 'Clear advice. Strong representation.', query: 'law office lawyer',
    servicesSlug: 'practice-areas', servicesTitle: 'Practice Areas',
    features: [['30+ Years', 'Decades of combined courtroom experience.'], ['Client Focused', 'Direct access to your attorney.'], ['Free Consultation', 'Understand your options at no cost.']],
    services: [['Family Law', 'Divorce, custody and mediation.'], ['Business Law', 'Contracts, formation and disputes.'], ['Real Estate', 'Closings, leases and title issues.'], ['Estate Planning', 'Wills, trusts and probate.']],
    cta: 'Schedule a free consultation', about: 'Harper & Cole is an independent firm that pairs big-firm expertise with personal attention.',
  },
  {
    id: 'realestate', label: 'Real Estate', name: 'Keystone Realty', domain: 'keystone-realty.com',
    tagline: 'Find the place you belong', query: 'modern house interior',
    servicesSlug: 'listings', servicesTitle: 'Listings',
    features: [['Local Experts', 'Agents who know every neighborhood.'], ['Fair Pricing', 'Data-driven valuations you can trust.'], ['Full Support', 'From first viewing to final signature.']],
    services: [['Family Homes', 'Spacious houses near great schools.'], ['City Apartments', 'Modern living close to everything.'], ['Luxury Estates', 'Exceptional properties with character.'], ['Commercial', 'Offices and retail spaces.']],
    cta: 'Get a free home valuation', about: 'Keystone Realty helps buyers, sellers and renters make confident moves with honest advice.',
  },
  {
    id: 'photography', label: 'Photography Portfolio', name: 'Mira Lens Studio', domain: 'miralens.studio',
    tagline: 'Moments, beautifully kept', query: 'photography portrait landscape',
    servicesSlug: 'services', servicesTitle: 'Services',
    features: [['Natural Light', 'Honest, warm and timeless images.'], ['Fast Delivery', 'Edited galleries within two weeks.'], ['Print Ready', 'High-resolution files and prints.']],
    services: [['Weddings', 'Full-day coverage of your story.'], ['Portraits', 'Individuals, couples and families.'], ['Brands', 'Product and lifestyle imagery.'], ['Events', 'Parties, launches and conferences.']],
    cta: 'Check my availability', about: 'I am a photographer who loves quiet details, golden light and real emotion.',
  },
  {
    id: 'yoga', label: 'Yoga Studio', name: 'Lotus Flow Yoga', domain: 'lotusflow.yoga',
    tagline: 'Breathe, move, restore', query: 'yoga meditation studio',
    servicesSlug: 'classes', servicesTitle: 'Classes',
    features: [['All Levels', 'Beginner-friendly classes every day.'], ['Small Groups', 'Personal attention in every class.'], ['Calm Space', 'A bright, peaceful studio.']],
    services: [['Vinyasa Flow', 'Dynamic sequences linked with breath.'], ['Yin Yoga', 'Slow, deep stretches to release tension.'], ['Meditation', 'Guided practice for a quiet mind.'], ['Prenatal', 'Gentle yoga for expecting mothers.']],
    cta: 'Your first class is free', about: 'Lotus Flow is a community studio where everyone is welcome on the mat, whatever their age or experience.',
  },
  {
    id: 'startup', label: 'Tech Startup', name: 'Nimbus Labs', domain: 'nimbuslabs.io',
    tagline: 'Ship faster with smarter cloud tools', query: 'technology startup office',
    servicesSlug: 'product', servicesTitle: 'Product',
    features: [['Lightning Fast', 'Deploy in seconds, not hours.'], ['Secure by Default', 'Encryption and SSO built in.'], ['Scales With You', 'From side project to enterprise.']],
    services: [['Deploy', 'One-click deploys from your repo.'], ['Monitor', 'Real-time metrics and alerts.'], ['Collaborate', 'Shared environments for your team.'], ['Integrate', 'Works with the tools you already use.']],
    cta: 'Start your free trial', about: 'Nimbus Labs is a small team of engineers building the developer tools we always wanted.',
  },
  {
    id: 'travel', label: 'Travel Agency', name: 'Wanderway Travel', domain: 'wanderway.travel',
    tagline: 'Journeys crafted around you', query: 'travel beach mountains',
    servicesSlug: 'destinations', servicesTitle: 'Destinations',
    features: [['Tailor-Made Trips', 'Every itinerary designed for you.'], ['24/7 Support', 'Help wherever you are in the world.'], ['Best Value', 'Trusted partners and fair prices.']],
    services: [['Beach Escapes', 'Sun, sand and crystal-clear water.'], ['City Breaks', 'Culture, food and nightlife.'], ['Mountain Adventures', 'Hiking, skiing and fresh air.'], ['Safari', 'Unforgettable wildlife encounters.']],
    cta: 'Plan my next trip', about: 'Wanderway was founded by lifelong travellers who want to share the world’s best experiences with you.',
  },
];


// Extra copy per niche: testimonials [quote, name, role], faq [question, answer],
// team [name, role, bio], pricing [name, price, period, features, highlighted] (optional).
const extras = {
  restaurant: {
    testimonials: [['The best carbonara outside of Rome. We come back every month.', 'Sofia R.', 'Regular guest'], ['Warm staff, perfect wine pairing and a tiramisu to die for.', 'Daniel K.', 'Food blogger'], ['We booked our anniversary dinner here and it was unforgettable.', 'Maya & Tom', 'Anniversary dinner']],
    faq: [['Do you take reservations?', 'Yes. Call us or use the contact form and we will confirm your table the same day.'], ['Do you have vegetarian and gluten-free options?', 'Most of our pasta can be made gluten-free, and every section of the menu has vegetarian dishes.'], ['Can I book the restaurant for a private event?', 'Yes, our back room seats up to 40 guests. Get in touch for set menus and pricing.']],
    team: [['Luigi Bianchi', 'Head chef & owner', 'Cooking family recipes since he was twelve.'], ['Giulia Rossi', 'Pastry chef', 'Makes every dessert in-house each morning.'], ['Marco Conti', 'Sommelier', 'Curates our list of regional Italian wines.']],
  },
  coffee: {
    testimonials: [['My favourite flat white in town, and the staff remember my order.', 'Ella M.', 'Daily regular'], ['Perfect spot to work for a few hours. Great Wi-Fi and better banana bread.', 'Jon P.', 'Freelance designer'], ['Their single-origin pour-over changed how I think about coffee.', 'Priya S.', 'Coffee lover']],
    faq: [['Do you have plant-based milk?', 'Yes: oat, almond and soy at no extra charge.'], ['Can I buy your beans to brew at home?', 'Yes, whole bean or ground to order, roasted fresh every week.'], ['Is there Wi-Fi and power for laptops?', 'Free Wi-Fi and plenty of sockets. We just ask laptop users to share big tables at lunchtime.']],
    team: [['Nora Lind', 'Founder & head roaster', 'Sources beans directly from small farms.'], ['Sam Ortiz', 'Head barista', 'Two-time regional latte art champion.'], ['Lea Park', 'Pastry baker', 'Bakes everything on the counter each morning.']],
  },
  gym: {
    testimonials: [['Lost 12 kg in six months with the coaches here. The community keeps me going.', 'Chris D.', 'Member since 2023'], ['Clean, never crowded, and the 24/7 access fits my shift work.', 'Ana L.', 'Nurse'], ['The strength program finally got me my first pull-up at 45!', 'Mike B.', 'Strength class']],
    faq: [['Can I try the gym before joining?', 'Yes, your first week is free. Just bring a photo ID.'], ['Is there a joining fee or contract?', 'No joining fee, and memberships are month to month. Cancel any time.'], ['Do you offer classes for beginners?', 'Every class has beginner options, and our coaches will help you with technique.']],
    team: [['Jake Moreno', 'Head coach', 'Certified strength and conditioning specialist.'], ['Tara Singh', 'HIIT & spin coach', 'Brings the energy to every early class.'], ['Leo Grant', 'Personal trainer', 'Specialises in mobility and injury recovery.']],
    pricing: [['Basic', '$29', '/month', 'Gym floor access\nLocker rooms\nFree fitness assessment', false], ['Unlimited', '$49', '/month', '24/7 access\nAll group classes\nGuest pass each month\nApp workout plans', true], ['Coaching', '$129', '/month', 'Everything in Unlimited\n4 personal training sessions\nNutrition guidance', false]],
  },
  dental: {
    testimonials: [['I used to dread the dentist. Here I actually feel relaxed.', 'Hannah W.', 'Patient'], ['They fixed my chipped tooth the same day. Amazing work.', 'Oliver T.', 'Patient'], ['Our kids love their visits and the team is so patient with them.', 'The Garcia family', 'Family patients']],
    faq: [['Do you accept insurance?', 'We work with most major dental insurance plans and can check your coverage before treatment.'], ['Do you handle dental emergencies?', 'Yes, we keep same-day slots free for emergencies. Call us first thing in the morning.'], ['How often should I have a check-up?', 'Every six months for most people. We will recommend a schedule that fits your needs.']],
    team: [['Dr. Emily Chen', 'Lead dentist', '15 years of experience in family dentistry.'], ['Dr. Ravi Patel', 'Orthodontist', 'Specialist in clear aligners and braces.'], ['Laura Fox', 'Dental hygienist', 'Gentle cleanings and great advice.']],
  },
  law: {
    testimonials: [['They explained every step clearly and got us a fair settlement.', 'Robert H.', 'Business client'], ['Compassionate and professional during a very hard divorce.', 'Lisa M.', 'Family law client'], ['Our estate plan was done quickly and without legal jargon.', 'Paul & Jean S.', 'Estate planning']],
    faq: [['Is the first consultation really free?', 'Yes. The first 30-minute consultation is free and there is no obligation.'], ['How are your fees structured?', 'Depending on the case we offer fixed fees, hourly rates or contingency arrangements. We agree fees in writing up front.'], ['How long will my case take?', 'Every case is different. After the first meeting we give you a realistic timeline and keep you updated.']],
    team: [['Grace Harper', 'Founding partner', 'Family and estate law, 20+ years.'], ['Nathan Cole', 'Founding partner', 'Business law and commercial disputes.'], ['Irene Walsh', 'Associate attorney', 'Real estate and property law.']],
  },
  realestate: {
    testimonials: [['Sold our house above asking price in under two weeks.', 'Karen & Bill', 'Home sellers'], ['They found us the perfect first apartment and handled all the paperwork.', 'Tyler J.', 'First-time buyer'], ['Honest advice, no pressure. I would use Keystone again in a heartbeat.', 'Monica F.', 'Home buyer']],
    faq: [['How do you value my home?', 'We compare recent local sales, current listings and your home features, then visit in person.'], ['What are your fees?', 'Our commission is agreed up front, and you only pay when your property sells.'], ['Can you help me get a mortgage?', 'We work with trusted mortgage advisers and can introduce you at no cost.']],
    team: [['Alex Turner', 'Managing broker', 'Has helped over 600 families move.'], ['Bella Nguyen', 'Sales agent', 'City apartment and condo specialist.'], ['Victor Lopez', 'Commercial agent', 'Offices, retail and investment property.']],
  },
  photography: {
    testimonials: [['Mira captured our wedding perfectly. We relive the day every time we look at the photos.', 'Amelia & Jack', 'Wedding couple'], ['Our product shots doubled our online sales.', 'Lena K.', 'Shop owner'], ['Relaxed, fun and the family portraits are stunning.', 'The Novak family', 'Family session']],
    faq: [['How many photos will I receive?', 'Usually 50–80 edited images per hour of shooting, delivered in an online gallery.'], ['Do you travel for shoots?', 'Yes, anywhere. Travel within 50 km is included in the price.'], ['How do I book a date?', 'Send a message with your date and plans. A 30% deposit secures your booking.']],
    team: [['Mira Lens', 'Photographer & founder', 'Ten years of weddings, portraits and brands.'], ['Tom Ashby', 'Second shooter', 'Captures the candid moments at weddings.'], ['Ivy Cole', 'Retoucher', 'Natural, timeless editing.']],
    pricing: [['Portrait', '$290', '/session', '1-hour session\n1 location\n40 edited photos', false], ['Wedding', '$2,400', '/day', '8 hours of coverage\nSecond photographer\n500+ edited photos\nOnline gallery', true], ['Brand', '$650', '/half day', '4 hours on location\nProduct & lifestyle shots\nCommercial license', false]],
  },
  yoga: {
    testimonials: [['Lotus Flow is my calm place. I leave every class lighter.', 'Rachel P.', 'Member'], ['As a total beginner I felt welcome from day one.', 'Ben O.', 'Beginner'], ['The prenatal classes helped me so much during pregnancy.', 'Sara L.', 'Prenatal student']],
    faq: [['I have never done yoga. Where do I start?', 'Try our Beginner Flow or Yin classes. Teachers offer options for every level.'], ['What should I bring?', 'Comfortable clothes and water. Mats and props are free to use.'], ['Do I need to book in advance?', 'Booking is recommended because classes are small, but drop-ins are welcome when space allows.']],
    team: [['Maya Rivers', 'Founder & lead teacher', '500-hour certified Vinyasa teacher.'], ['Kai Moon', 'Yin & meditation teacher', 'Teaches stillness and breathwork.'], ['Ines Duarte', 'Prenatal teacher', 'Doula and certified prenatal yoga teacher.']],
    pricing: [['Drop-in', '$18', '/class', 'Any single class\nMat & props included', false], ['Monthly', '$99', '/month', 'Unlimited classes\nOnline class library\n10% off workshops', true], ['10-class pass', '$150', '', 'Valid for 4 months\nShareable with a friend', false]],
  },
  startup: {
    testimonials: [['We cut our deploy time from 40 minutes to 30 seconds.', 'Jordan L.', 'CTO, Brightly'], ['Setup took one afternoon. Support answers in minutes.', 'Kim A.', 'Lead engineer, Parcel'], ['Finally, monitoring our whole team actually uses.', 'Samir H.', 'Founder, Loopwise']],
    faq: [['Is there a free plan?', 'Yes. The Starter plan is free forever for personal projects.'], ['Can I migrate from my current platform?', 'Yes, our import tool moves your apps and environment variables in a few clicks.'], ['Where is my data stored?', 'In EU or US regions of your choice, encrypted at rest and in transit.']],
    team: [['Ava Brooks', 'CEO & co-founder', 'Previously led platform engineering at a unicorn.'], ['Noah Kim', 'CTO & co-founder', 'Built deploy tools used by thousands of developers.'], ['Zoe Martin', 'Head of design', 'Makes complex tools feel simple.']],
    pricing: [['Starter', '$0', '/month', '3 projects\nCommunity support\nBasic metrics', false], ['Team', '$49', '/user/month', 'Unlimited projects\nPreview environments\nAlerts & dashboards\nPriority support', true], ['Enterprise', 'Custom', '', 'SSO & audit logs\nDedicated support\n99.99% SLA', false]],
  },
  travel: {
    testimonials: [['Our honeymoon in Bali was planned down to the last detail. Pure magic.', 'Emma & Luis', 'Honeymooners'], ['When our flight was cancelled they rebooked us within an hour.', 'David N.', 'Family trip'], ['The safari was the trip of a lifetime. Thank you, Wanderway!', 'Claire B.', 'Adventure traveller']],
    faq: [['Can you plan a trip for a specific budget?', 'Absolutely. Tell us your budget and we will design the best trip within it.'], ['Is travel insurance included?', 'Insurance is optional and we can add a policy that covers your whole trip.'], ['How far in advance should I book?', '3–6 months ahead is ideal, but we can often arrange last-minute trips too.']],
    team: [['Olivia Hart', 'Founder & travel designer', 'Has visited over 70 countries.'], ['Mateo Silva', 'Adventure specialist', 'Safaris, treks and expeditions.'], ['Hana Sato', 'Asia specialist', 'Japan, Bali and Southeast Asia expert.']],
  },
};

const presets = niches.map((n, i) => {
  const x = extras[n.id];
  const phone = `+1 (555) 010-${2000 + i * 111}`;
  const address = '123 Main Street, Springfield';
  const servicesBlocks = [
    { type: 'hero', heading: n.servicesTitle, subheading: 'Everything we offer', image: 'auto', imageAlt: '', buttonText: '', buttonLink: '' },
    { type: 'features', heading: 'What we offer', items: n.services.map(([title, text]) => ({ title, text, image: 'auto', imageAlt: '' })) },
  ];
  if (x.pricing) {
    servicesBlocks.push({
      type: 'pricing',
      heading: 'Pricing',
      plans: x.pricing.map(([name, price, period, features, highlighted]) => ({ name, price, period, features, buttonText: 'Get started', buttonLink: 'contact', highlighted })),
    });
  }
  servicesBlocks.push(
    { type: 'faq', heading: 'Frequently asked questions', items: x.faq.map(([question, answer]) => ({ question, answer })) },
    { type: 'cta', heading: n.cta, text: 'Questions? We are happy to help.', buttonText: 'Get in touch', buttonLink: 'contact' }
  );

  return {
    id: n.id,
    label: n.label,
    name: n.name,
    domain: n.domain,
    tagline: n.tagline,
    imageQuery: n.query,
    email: `hello@${n.domain}`,
    phone,
    address,
    pages: [
      {
        slug: 'home', title: 'Home',
        blocks: [
          { type: 'hero', heading: n.name, subheading: n.tagline, image: 'auto', imageAlt: '', buttonText: n.cta, buttonLink: 'contact' },
          { type: 'features', heading: 'Why choose us', items: n.features.map(([title, text]) => ({ title, text, image: '', imageAlt: '' })) },
          { type: 'imageText', heading: 'Our story', body: n.about, image: 'auto', imageAlt: '', buttonText: '', buttonLink: '' },
          { type: 'testimonials', heading: 'What people say', items: x.testimonials.map(([quote, name, role]) => ({ quote, name, role, image: '' })) },
          { type: 'cta', heading: n.cta, text: 'We would love to hear from you.', buttonText: 'Contact us', buttonLink: 'contact' },
        ],
      },
      {
        slug: 'about', title: 'About',
        blocks: [
          { type: 'hero', heading: 'About us', subheading: n.tagline, image: 'auto', imageAlt: '', buttonText: '', buttonLink: '' },
          { type: 'imageText', heading: 'Who we are', body: n.about, image: 'auto', imageAlt: '', buttonText: '', buttonLink: '' },
          { type: 'team', heading: 'Meet the team', members: x.team.map(([name, role, bio]) => ({ name, role, bio, image: '' })) },
          { type: 'text', heading: 'Our values', body: 'Quality, honesty and care guide everything we do. We take the time to listen and we are proud of the work we deliver.' },
        ],
      },
      { slug: n.servicesSlug, title: n.servicesTitle, blocks: servicesBlocks },
      {
        slug: 'gallery', title: 'Gallery',
        blocks: [
          { type: 'hero', heading: 'Gallery', subheading: 'A look inside', image: 'auto', imageAlt: '', buttonText: '', buttonLink: '' },
          { type: 'gallery', heading: '', images: Array.from({ length: 6 }, () => ({ src: 'auto', alt: '' })) },
        ],
      },
      {
        slug: 'contact', title: 'Contact',
        blocks: [
          { type: 'hero', heading: 'Contact', subheading: 'We would love to hear from you', image: 'auto', imageAlt: '', buttonText: '', buttonLink: '' },
          { type: 'contact', heading: 'Get in touch', address, phone, email: `hello@${n.domain}`, hours: 'Mon–Fri 9:00–18:00' },
          { type: 'map', heading: 'Find us', address },
        ],
      },
    ],
  };
});

const out = path.join(__dirname, '..', 'presets', 'presets.json');
fs.writeFileSync(out, JSON.stringify(presets, null, 2) + '\n');
console.log(`Wrote ${presets.length} presets to presets/presets.json`);
