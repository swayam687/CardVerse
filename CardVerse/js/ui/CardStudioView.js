/* ============================================================
   ui/CardStudioView.js
   --------------------------------------------------------
   Currently the entry point is Modal.customDeck (defined in
   Modal.js). This file exists as the future home of a proper
   visual card builder.
   ============================================================ */
const CardStudioView = {
  open() {
    if (typeof Modal !== 'undefined' && Modal.customDeck) {
      Modal.customDeck(def => LobbyView.addCustomUniverse(def));
    }
  }
};