from flask import Flask, render_template
import os

# Explicitly set the template folder
template_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
app = Flask(__name__, template_folder=template_dir)

@app.route('/')
def home():
    print("Rendering home page")  # Debug print
    return render_template('index.html')

@app.route('/about')
def about():
    print("Rendering about page")  # Debug print
    return render_template('about.html')

if __name__ == '__main__':
    app.run(debug=True)
