"""Genera Manual_de_Usuario_Tropa_Gym.pdf a partir de manual_usuario_tropa_gym.html.

Requiere: pip install playwright && playwright install (o channel="chrome" para
reusar el Chrome ya instalado en la máquina, sin descargar Chromium aparte).

Si se edita algún módulo NN_*.html, hay que trasladar el mismo cambio a mano
dentro de manual_usuario_tropa_gym.html (portada, índice y los 9 módulos van
concatenados ahí, con CSS extra de impresión — ver comentario al final del
<style> combinado) y después correr este script.

Uso: python generar_pdf.py (desde esta carpeta o cualquier otra — usa rutas
absolutas relativas a este archivo).
"""

import pathlib
import urllib.parse

from playwright.sync_api import sync_playwright

DIR = pathlib.Path(__file__).parent
SRC = DIR / "manual_usuario_tropa_gym.html"
OUT = DIR / "Manual_de_Usuario_Tropa_Gym.pdf"


def to_file_url(path: pathlib.Path) -> str:
    # Chrome headless devuelve ERR_FILE_NOT_FOUND en silencio si una ruta
    # file:// con espacios (ej. "Theaux soluciones") no está URL-encodeada —
    # el "PDF" resultante termina siendo la página de error. Encodear cada
    # segmento evita eso.
    parts = str(path.resolve()).replace("\\", "/").split("/")
    return "file:///" + "/".join(urllib.parse.quote(p) for p in parts)


def main() -> None:
    url = to_file_url(SRC)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        page = browser.new_page()
        page.goto(url)
        page.pdf(
            path=str(OUT),
            display_header_footer=False,
            print_background=True,
            prefer_css_page_size=True,
        )
        browser.close()
    print(f"Generado: {OUT}")


if __name__ == "__main__":
    main()
