document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const songOutput = document.getElementById('songOutput');

    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect, false);
    } else {
        console.error("File input element not found!");
    }

    function handleFileSelect(event) {
        // Clear previous output
        if (songOutput) {
            songOutput.innerHTML = '';
        } else {
            console.error("Song output element not found!");
            return;
        }

        const files = event.target.files;
        if (files.length === 0) {
            // No file selected, or file selection was cancelled
            return;
        }

        const file = files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            const textContent = e.target.result;
            if (textContent === null) {
                songOutput.textContent = 'Error: Could not read file content.';
                return;
            }
            parseAndDisplaySong(textContent);
        };

        reader.onerror = function(e) {
            songOutput.textContent = 'Error reading file: ' + e.target.error.name;
            console.error("FileReader error:", e.target.error);
        };

        reader.readAsText(file);
    }

    function parseAndDisplaySong(textContent) {
        const lines = textContent.split(/\r?\n/);
        const songData = [];
        const parsingErrors = []; // Initialize array to collect parsing errors
        let currentOpus = null;
        let currentSection = null;
        let currentItem = null;

        const opusRegex = /^\[\[\[(Opus .*?)\]\]\]$/;
        const sectionRegex = /^\[\[(.*?)\]\]$/;
        const descriptorRegex = /^\[(.*?)\]$/;

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine === '') {
                return; // Skip empty lines
            }

            const opusMatch = trimmedLine.match(opusRegex);
            const sectionMatch = trimmedLine.match(sectionRegex);
            const descriptorMatch = trimmedLine.match(descriptorRegex);

            if (opusMatch) {
                const title = opusMatch[1];
                currentOpus = { title: title, sections: [] };
                songData.push(currentOpus);
                currentSection = null;
                currentItem = null;
            } else if (sectionMatch) {
                const title = sectionMatch[1];
                currentSection = { title: title, items: [] };
                if (currentOpus) {
                    currentOpus.sections.push(currentSection);
                } else {
                    // console.error("Section found without Opus: " + title);
                    parsingErrors.push(`Error: Section "${title}" found without a parent Opus.`);
                    // Optionally, handle as a global section or add to a default Opus
                }
                currentItem = null;
            } else if (descriptorMatch) {
                const descriptor = descriptorMatch[1];
                currentItem = { descriptor: descriptor, notes: '' };
                if (currentSection) {
                    currentSection.items.push(currentItem);
                } else {
                    // console.error("Descriptor found without Section: " + descriptor);
                    parsingErrors.push(`Error: Descriptor "[${descriptor}]" found without a parent Section.`);
                }
            } else { // Notes line
                if (currentItem) {
                    if (currentItem.notes === '') {
                        currentItem.notes = trimmedLine;
                    } else {
                        currentItem.notes += '\n' + trimmedLine; // Concatenate multi-line notes
                    }
                } else {
                    // console.error("Notes found without a preceding descriptor: " + trimmedLine);
                    parsingErrors.push(`Error: Notes "${trimmedLine.substring(0, 30)}..." found without a preceding descriptor.`);
                }
            }
        });

        console.log("Parsed song data:");
        console.log(JSON.stringify(songData, null, 2));
        if (parsingErrors.length > 0) {
            console.warn("Parsing errors occurred:", parsingErrors);
        }

        // Call the display function, passing parsingErrors
        displaySongData(songData, parsingErrors);
    }

    function displaySongData(songData, parsingErrors = []) {
        const songOutput = document.getElementById('songOutput');
        if (!songOutput) {
            console.error("Song output element not found for display!");
            return;
        }
        songOutput.innerHTML = ''; // Clear previous content

        if (parsingErrors && parsingErrors.length > 0) {
            const errorSummaryDiv = document.createElement('div');
            errorSummaryDiv.className = 'parsing-error-summary'; // Will style this with CSS later
            errorSummaryDiv.innerHTML = '<h4>Parsing Issues Found:</h4>';
            const errorList = document.createElement('ul');
            parsingErrors.forEach(errMsg => {
                const li = document.createElement('li');
                li.textContent = errMsg;
                errorList.appendChild(li);
            });
            errorSummaryDiv.appendChild(errorList);
            songOutput.appendChild(errorSummaryDiv);
        }

        if (!songData || songData.length === 0) {
            // Adjusted message slightly to make sense if errors are already displayed
            const noDataMsg = document.createElement('p');
            noDataMsg.textContent = (parsingErrors && parsingErrors.length > 0) ? 
                                   'Additionally, no valid song structure could be displayed.' : 
                                   'No song data to display. Try uploading a valid file.';
            songOutput.appendChild(noDataMsg);
            return;
        }

        songData.forEach(opus => {
            if (!opus || typeof opus.title !== 'string') {
                console.warn("Skipping invalid opus object:", opus);
                return; // Skip this opus if it's not valid
            }

            const opusDiv = document.createElement('div');
            opusDiv.className = 'opus-container'; // For potential future styling

            const opusTitleEl = document.createElement('h2');
            opusTitleEl.className = 'opus-title';
            opusTitleEl.textContent = opus.title;
            opusDiv.appendChild(opusTitleEl);

            if (opus.sections && opus.sections.length > 0) {
                opus.sections.forEach(section => {
                    if (!section || typeof section.title !== 'string') {
                        console.warn("Skipping invalid section object:", section);
                        return; // Skip this section
                    }

                    const sectionDiv = document.createElement('div');
                    sectionDiv.className = 'section-container';

                    const sectionTitleEl = document.createElement('h3');
                    sectionTitleEl.className = 'section-title';
                    sectionTitleEl.textContent = section.title;
                    sectionDiv.appendChild(sectionTitleEl);

                    if (section.items && section.items.length > 0) {
                        section.items.forEach(item => {
                            if (!item || typeof item.descriptor !== 'string') {
                                console.warn("Skipping invalid item object:", item);
                                return; // Skip this item
                            }

                            const itemDiv = document.createElement('div');
                            itemDiv.className = 'item-container';

                            const descriptorEl = document.createElement('p');
                            descriptorEl.className = 'chord-descriptor';
                            descriptorEl.textContent = `[${item.descriptor}]`;
                            itemDiv.appendChild(descriptorEl);

                            if (typeof item.notes === 'string' && item.notes.trim() !== '') {
                                const notesEl = document.createElement('pre'); // Use <pre> for preserving formatting
                                notesEl.className = 'notes-sequence';
                                notesEl.textContent = item.notes;
                                itemDiv.appendChild(notesEl);
                            }
                            sectionDiv.appendChild(itemDiv);
                        });
                    }
                    opusDiv.appendChild(sectionDiv);
                });
            }
            songOutput.appendChild(opusDiv);
        });
    }
});
