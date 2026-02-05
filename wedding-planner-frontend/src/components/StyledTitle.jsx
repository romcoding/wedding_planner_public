/**
 * StyledTitle - Renders text with the first letter of each word in a decorative font
 * 
 * Example: "Wedding Pass" → "W" and "P" get special styling with Playfair Display
 */
export default function StyledTitle({ text, className = '', style = {} }) {
  const words = text.split(' ');
  
  return (
    <span className={className} style={style}>
      {words.map((word, i) => (
        <span key={i}>
          {i > 0 && ' '}
          <span style={{ 
            fontFamily: '"Playfair Display", serif',
            fontStyle: 'italic',
            fontSize: '1.15em',
            marginRight: '-0.05em'
          }}>
            {word[0]}
          </span>
          {word.slice(1)}
        </span>
      ))}
    </span>
  );
}
