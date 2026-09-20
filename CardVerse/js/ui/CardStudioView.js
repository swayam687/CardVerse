/* ============================================================
   js/ui/CardStudioView.js
   ============================================================ */

const CardStudioView = {
  open() {
    if (typeof Modal === 'undefined' || typeof Modal.customDeck !== 'function') {
      if (typeof Toast !== 'undefined') {
        Toast.show('Deck Studio is unavailable right now.');
      } else {
        alert('Deck Studio is unavailable right now.');
      }
      return;
    }
    Modal.customDeck(def => {
      if (typeof LobbyView !== 'undefined' && LobbyView.addCustomUniverse) {
        LobbyView.addCustomUniverse(def);
      }
    });
  }
};