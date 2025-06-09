import { Document, Page, Text, Image, StyleSheet, View, Font } from '@react-pdf/renderer';

// Czcionki
Font.register({ family: 'ComicNeue', src: '/fonts/ComicNeue-Regular.ttf' });
Font.register({ family: 'Merriweather', src: '/fonts/Merriweather-Regular.ttf' });
Font.register({ family: 'OpenDyslexic', src: '/fonts/OpenDyslexic-Regular.otf' });

const createStyles = (fontFamily) => StyleSheet.create({
  page: { padding: 30, fontFamily },
  section: { marginBottom: 30 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  text: { fontSize: 12, marginBottom: 10 },
  image: { width: '100%', height: 400, objectFit: 'cover', marginBottom: 20 },
  coverTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  dedicationText: { fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 200 },
  endingText: { fontSize: 16, textAlign: 'center', marginTop: 250 },
});

const BookDocument = ({ storyTitle, storyParts, coverImageBase64, endingImageBase64, dedicationText, fontChoice }) => {
  const styles = createStyles(fontChoice || 'ComicNeue');

  return (
    <Document>
      {/* Okładka */}
      <Page style={styles.page}>
        {coverImageBase64 && <Image style={styles.image} src={`data:image/png;base64,${coverImageBase64}`} />}
        <Text style={styles.coverTitle}>{storyTitle}</Text>
      </Page>

      {/* Fragmenty bajki */}
      {storyParts.map((fragment, index) => (
        <Page key={index} style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.title}>Fragment {index + 1}</Text>
            <Text style={styles.text}>{fragment.text}</Text>
            {fragment.imageBase64 && <Image style={styles.image} src={`data:image/png;base64,${fragment.imageBase64}`} />}
          </View>
        </Page>
      ))}

      {/* Dedykacja */}
      <Page style={styles.page}>
        <Text style={styles.dedicationText}>{dedicationText}</Text>
      </Page>

      {/* Zakończenie */}
      <Page style={styles.page}>
        {endingImageBase64 && <Image style={styles.image} src={`data:image/png;base64,${endingImageBase64}`} />}
        <Text style={styles.endingText}>Koniec bajki</Text>
      </Page>
    </Document>
  );
};

export default BookDocument;
