export function Rules({ onBack }: { onBack: () => void }) {
  return (
    <div className="rules">
      <button className="ghost" onClick={onBack}>
        ← Zurück
      </button>
      <h1>Spielregeln</h1>

      <h2>Karten</h2>
      <p>Gespielt wird mit 108 Karten: zwei Pakete à 52 Karten und 4 Joker. Joker und Zweien sind Wildcards.</p>
      <table className="score-table">
        <tbody>
          <tr><td>Joker</td><td>50</td></tr>
          <tr><td>Zweien, Asse</td><td>20</td></tr>
          <tr><td>König bis Acht</td><td>10</td></tr>
          <tr><td>Sieben bis Vier, schwarze Drei</td><td>5</td></tr>
        </tbody>
      </table>

      <h2>Spieler</h2>
      <p>
        <b>4 Spieler:</b> Du spielst mit Max gegen Lena und Jonas. Jeder bekommt 11 Karten, das Team legt gemeinsam aus.
        Zum Ausmachen braucht das Team einen Canasta.
        <br />
        <b>2 Spieler:</b> Jeder bekommt 15 Karten und zieht 2 Karten vom Stock (wirft aber nur eine ab). Zum Ausmachen
        braucht man zwei Canastas.
      </p>

      <h2>Spielzug</h2>
      <ol>
        <li>Vom Stock ziehen <i>oder</i> den ganzen Ablagestapel aufnehmen.</li>
        <li>Beliebig viele Karten auslegen (optional).</li>
        <li>Eine Karte abwerfen.</li>
      </ol>

      <h2>Meldungen</h2>
      <p>
        Eine Meldung besteht aus mindestens 3 Karten gleichen Rangs, davon mindestens 2 natürliche und höchstens 3
        Wildcards. Ab 7 Karten ist es ein <b>Canasta</b>: rein (ohne Wildcards) 500 Punkte, gemischt 300 Punkte.
      </p>
      <p>
        <b>Erstmeldung:</b> Die erste Auslage einer Runde muss zusammen mindestens so viele Punkte haben:
      </p>
      <table className="score-table">
        <tbody>
          <tr><td>Stand unter 0</td><td>30</td></tr>
          <tr><td>0 bis 1495</td><td>50</td></tr>
          <tr><td>1500 bis 2995</td><td>90</td></tr>
          <tr><td>ab 3000</td><td>120</td></tr>
        </tbody>
      </table>
      <p>
        Mehrere Meldungen für die Erstmeldung wählst du mit <b>Vormerken</b> nacheinander aus und legst sie dann mit{' '}
        <b>Auslegen</b> gemeinsam aus.
      </p>

      <h2>Dreien</h2>
      <p>
        <b>Rote Dreien</b> werden sofort ausgelegt und durch eine neue Karte ersetzt. Sie zählen je 100 Punkte, alle vier
        zusammen 800 – aber <b>minus</b>, wenn das Team keinen Canasta hat.
        <br />
        <b>Schwarze Dreien</b> sperren den Ablagestapel für den nächsten Spieler. Melden darf man sie nur beim Ausmachen
        (3 oder 4 Stück, ohne Wildcards).
      </p>

      <h2>Ablagestapel aufnehmen</h2>
      <p>
        Die oberste Karte muss sofort verwendet werden: mit passenden Karten aus der Hand (wähle sie aus und tippe auf den
        Stapel) oder durch Anlegen an eine eigene Meldung (ohne Auswahl auf den Stapel tippen). Der Rest kommt auf die
        Hand.
      </p>
      <p>
        <b>Eingefroren</b> ist der Stapel, wenn eine Wildcard darin liegt (❄) oder dein Team noch nichts ausgelegt hat.
        Dann brauchst du zwei natürliche Karten vom Rang der obersten Karte. Liegt oben eine Wildcard oder eine schwarze
        Drei, kann der Stapel nicht aufgenommen werden.
      </p>

      <h2>Ausmachen</h2>
      <p>
        Wer seine letzte Karte auslegt oder abwirft, macht aus (Voraussetzung: Canasta). Bonus: <b>100</b> Punkte.
        <br />
        <b>Verdeckt</b> (dein Team hatte vorher nichts ausgelegt): <b>200</b> Punkte.
        <br />
        <b>Handcanasta</b> (alles in einem Zug, bevor überhaupt jemand ausgelegt hat): <b>1000</b> Punkte.
      </p>
      <p>
        Karten, die noch auf der Hand sind, werden abgezogen. Ist der Stock leer, endet die Runde ohne Ausmach-Bonus.
        Gewonnen hat, wer zuerst das Spielziel (Standard 5000) erreicht.
      </p>
    </div>
  );
}
