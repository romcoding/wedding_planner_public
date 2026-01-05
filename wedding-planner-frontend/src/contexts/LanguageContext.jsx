import { createContext, useContext, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

const LanguageContext = createContext()

const translations = {
  en: {
    welcome: 'Welcome',
    rsvp: 'RSVP',
    hi: 'Hi',
    fillForm: 'Please fill out the form below',
    introduction: "We are absolutely thrilled to celebrate this special day with you! Your presence means the world to us, and we can't wait to share this beautiful moment together. Please take a moment to fill out the form below so we can make sure everything is perfect for your visit. We've included sections for dietary preferences, music requests, and any special accommodations you might need. Don't hesitate to reach out if you have any questions. We're looking forward to seeing you soon!",
    rsvpDetails: 'RSVP Details',
    overnightStay: 'Overnight Stay',
    overnightStayQuestion: 'Would you like to stay overnight?',
    overnightStayYes: 'Yes, I would like to stay overnight',
    overnightStayNo: 'No, I would not like to stay overnight',
    overnightStayNote: 'You need to arrange accommodation yourselves.',
    select: 'Select...',
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
    fillForm: 'Bitte fülle das untenstehende Formular aus',
    introduction: 'Wir freuen uns riesig, diesen besonderen Tag mit dir zu feiern! Deine Anwesenheit bedeutet uns die Welt, und wir können es kaum erwarten, diesen wunderschönen Moment mit dir zu teilen. Bitte nimm dir einen Moment Zeit, um das untenstehende Formular auszufüllen, damit wir sicherstellen können, dass alles perfekt für deinen Besuch ist. Wir haben Abschnitte für Ernährungsvorlieben, Musikwünsche und alle besonderen Unterkünfte, die du möglicherweise benötigst, hinzugefügt. Zögere nicht, uns zu kontaktieren, wenn du Fragen hast. Wir freuen uns darauf, dich bald zu sehen!',
    rsvpDetails: 'RSVP Details',
    overnightStay: 'Übernachtung',
    overnightStayQuestion: 'Möchtest du übernachten?',
    overnightStayYes: 'Ja, ich möchte übernachten',
    overnightStayNo: 'Nein, ich möchte nicht übernachten',
    overnightStayNote: 'Die Unterkunft müsst ihr selbst übernehmen.',
    select: 'Auswählen...',
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
    musicPlaceholder: 'Welche Lieder möchtest du auf der Hochzeit hören?',
    dietaryInfo: 'Ernährungsinformationen',
    dietaryRestrictions: 'Ernährungseinschränkungen',
    dietaryPlaceholder: 'z.B. Vegetarisch, Vegan, Glutenfrei',
    allergies: 'Allergien',
    allergiesPlaceholder: 'Bitte liste alle Lebensmittelallergien auf',
    specialRequests: 'Besondere Wünsche',
    specialPlaceholder: 'Besondere Wünsche oder zusätzliche Informationen',
    submitRSVP: 'RSVP absenden',
    saving: 'Wird gespeichert...',
    ourStory: 'Unsere Geschichte',
    invalidLink: 'Ungültiger RSVP-Link',
    invalidLinkMessage: 'Dieser RSVP-Link ist nicht gültig. Bitte überprüfe den Link und versuche es erneut.',
    loadingRSVP: 'Dein RSVP wird geladen...',
    confirmAttendance: 'Bitte bestätige deine Teilnahme',
  },
  fr: {
    welcome: 'Bienvenue',
    rsvp: 'RSVP',
    hi: 'Salut',
    fillForm: 'Veuillez remplir le formulaire ci-dessous',
    introduction: "Nous sommes absolument ravis de célébrer ce jour spécial avec vous! Votre présence signifie tout pour nous, et nous avons hâte de partager ce beau moment ensemble. Veuillez prendre un moment pour remplir le formulaire ci-dessous afin que nous puissions nous assurer que tout est parfait pour votre visite. Nous avons inclus des sections pour les préférences alimentaires, les demandes musicales et tout hébergement spécial dont vous pourriez avoir besoin. N'hésitez pas à nous contacter si vous avez des questions. Nous avons hâte de vous voir bientôt!",
    rsvpDetails: 'Détails RSVP',
    overnightStay: 'Hébergement',
    overnightStayQuestion: 'Souhaitez-vous rester pour la nuit?',
    overnightStayYes: 'Oui, je souhaite rester pour la nuit',
    overnightStayNo: 'Non, je ne souhaite pas rester pour la nuit',
    overnightStayNote: 'Vous devez organiser l\'hébergement vous-mêmes.',
    select: 'Sélectionner...',
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

  // Fetch content from database
  const { data: contentItems } = useQuery({
    queryKey: ['content', 'public', language],
    queryFn: () => api.get(`/content?lang=${language}`).then((res) => res.data),
    enabled: true, // Always fetch
  })

  useEffect(() => {
    localStorage.setItem('guest_language', language)
  }, [language])

  const t = (key) => {
    // First try to get from database content
    if (contentItems) {
      const contentItem = contentItems.find(item => item.key === key)
      if (contentItem && contentItem.content) {
        return contentItem.content
      }
    }
    
    // Fallback to hardcoded translations
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

