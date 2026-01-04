import { createContext, useContext, useState, useEffect } from 'react'

const LanguageContext = createContext()

const translations = {
  en: {
    welcome: 'Welcome',
    rsvp: 'RSVP',
    hi: 'Hi',
    fillForm: 'Please fill out the form below',
    introduction: "We are absolutely thrilled to celebrate this special day with you! Your presence means the world to us, and we can't wait to share this beautiful moment together. Please take a moment to fill out the form below so we can make sure everything is perfect for your visit. We've included sections for dietary preferences, music requests, and any special accommodations you might need. Don't hesitate to reach out if you have any questions. We're looking forward to seeing you soon!",
    rsvpDetails: 'RSVP Details',
    attendance: 'Attendance',
    select: 'Select...',
    ceremonyOnly: 'Ceremony Only',
    receptionOnly: 'Reception Only',
    bothEvents: 'Both Events',
    numberOfGuests: 'Number of Guests',
    rsvpStatus: 'RSVP Status',
    pending: 'Pending',
    confirmed: 'Confirmed',
    declined: 'Declined',
    contactInfo: 'Contact Information',
    phone: 'Phone',
    address: 'Address',
    musicWish: 'Music Wish',
    songRequests: 'Song Requests',
    musicPlaceholder: 'What songs would you like to hear at the wedding?',
    dietaryInfo: 'Dietary Information',
    dietaryRestrictions: 'Dietary Restrictions',
    dietaryPlaceholder: 'e.g., Vegetarian, Vegan, Gluten-free',
    allergies: 'Allergies',
    allergiesPlaceholder: 'Please list any food allergies',
    specialRequests: 'Special Requests',
    specialPlaceholder: 'Any special requests or additional information',
    submitRSVP: 'Submit RSVP',
    saving: 'Saving...',
    ourStory: 'Our Story',
    invalidLink: 'Invalid RSVP Link',
    invalidLinkMessage: 'This RSVP link is not valid. Please check the link and try again.',
    loadingRSVP: 'Loading your RSVP...',
    confirmAttendance: 'Please confirm your attendance',
  },
  de: {
    welcome: 'Willkommen',
    rsvp: 'RSVP',
    hi: 'Hallo',
    fillForm: 'Bitte füllen Sie das untenstehende Formular aus',
    introduction: 'Wir freuen uns riesig, diesen besonderen Tag mit Ihnen zu feiern! Ihre Anwesenheit bedeutet uns die Welt, und wir können es kaum erwarten, diesen wunderschönen Moment mit Ihnen zu teilen. Bitte nehmen Sie sich einen Moment Zeit, um das untenstehende Formular auszufüllen, damit wir sicherstellen können, dass alles perfekt für Ihren Besuch ist. Wir haben Abschnitte für Ernährungsvorlieben, Musikwünsche und alle besonderen Unterkünfte, die Sie möglicherweise benötigen, hinzugefügt. Zögern Sie nicht, uns zu kontaktieren, wenn Sie Fragen haben. Wir freuen uns darauf, Sie bald zu sehen!',
    rsvpDetails: 'RSVP Details',
    attendance: 'Teilnahme',
    select: 'Auswählen...',
    ceremonyOnly: 'Nur Zeremonie',
    receptionOnly: 'Nur Empfang',
    bothEvents: 'Beide Veranstaltungen',
    numberOfGuests: 'Anzahl der Gäste',
    rsvpStatus: 'RSVP Status',
    pending: 'Ausstehend',
    confirmed: 'Bestätigt',
    declined: 'Abgelehnt',
    contactInfo: 'Kontaktinformationen',
    phone: 'Telefon',
    address: 'Adresse',
    musicWish: 'Musikwunsch',
    songRequests: 'Liedwünsche',
    musicPlaceholder: 'Welche Lieder möchten Sie auf der Hochzeit hören?',
    dietaryInfo: 'Ernährungsinformationen',
    dietaryRestrictions: 'Ernährungseinschränkungen',
    dietaryPlaceholder: 'z.B. Vegetarisch, Vegan, Glutenfrei',
    allergies: 'Allergien',
    allergiesPlaceholder: 'Bitte listen Sie alle Lebensmittelallergien auf',
    specialRequests: 'Besondere Wünsche',
    specialPlaceholder: 'Besondere Wünsche oder zusätzliche Informationen',
    submitRSVP: 'RSVP absenden',
    saving: 'Wird gespeichert...',
    ourStory: 'Unsere Geschichte',
    invalidLink: 'Ungültiger RSVP-Link',
    invalidLinkMessage: 'Dieser RSVP-Link ist nicht gültig. Bitte überprüfen Sie den Link und versuchen Sie es erneut.',
    loadingRSVP: 'Ihr RSVP wird geladen...',
    confirmAttendance: 'Bitte bestätigen Sie Ihre Teilnahme',
  },
  fr: {
    welcome: 'Bienvenue',
    rsvp: 'RSVP',
    hi: 'Salut',
    fillForm: 'Veuillez remplir le formulaire ci-dessous',
    introduction: "Nous sommes absolument ravis de célébrer ce jour spécial avec vous! Votre présence signifie tout pour nous, et nous avons hâte de partager ce beau moment ensemble. Veuillez prendre un moment pour remplir le formulaire ci-dessous afin que nous puissions nous assurer que tout est parfait pour votre visite. Nous avons inclus des sections pour les préférences alimentaires, les demandes musicales et tout hébergement spécial dont vous pourriez avoir besoin. N'hésitez pas à nous contacter si vous avez des questions. Nous avons hâte de vous voir bientôt!",
    rsvpDetails: 'Détails RSVP',
    attendance: 'Présence',
    select: 'Sélectionner...',
    ceremonyOnly: 'Cérémonie uniquement',
    receptionOnly: 'Réception uniquement',
    bothEvents: 'Les deux événements',
    numberOfGuests: 'Nombre d\'invités',
    rsvpStatus: 'Statut RSVP',
    pending: 'En attente',
    confirmed: 'Confirmé',
    declined: 'Refusé',
    contactInfo: 'Informations de contact',
    phone: 'Téléphone',
    address: 'Adresse',
    musicWish: 'Souhait musical',
    songRequests: 'Demandes de chansons',
    musicPlaceholder: 'Quelles chansons aimeriez-vous entendre au mariage?',
    dietaryInfo: 'Informations diététiques',
    dietaryRestrictions: 'Restrictions alimentaires',
    dietaryPlaceholder: 'par ex. Végétarien, Végétalien, Sans gluten',
    allergies: 'Allergies',
    allergiesPlaceholder: 'Veuillez lister toutes les allergies alimentaires',
    specialRequests: 'Demandes spéciales',
    specialPlaceholder: 'Toute demande spéciale ou information supplémentaire',
    submitRSVP: 'Soumettre RSVP',
    saving: 'Enregistrement...',
    ourStory: 'Notre histoire',
    invalidLink: 'Lien RSVP invalide',
    invalidLinkMessage: 'Ce lien RSVP n\'est pas valide. Veuillez vérifier le lien et réessayer.',
    loadingRSVP: 'Chargement de votre RSVP...',
    confirmAttendance: 'Veuillez confirmer votre présence',
  },
}

export function LanguageProvider({ children, initialLanguage = 'en' }) {
  const [language, setLanguage] = useState(() => {
    // Try to get from localStorage or use initial language
    const saved = localStorage.getItem('guest_language')
    return saved || initialLanguage
  })

  useEffect(() => {
    localStorage.setItem('guest_language', language)
  }, [language])

  const t = (key) => {
    return translations[language]?.[key] || translations.en[key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

