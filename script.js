document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const songOutput = document.getElementById('songOutput');

    const SOLFEGE_TO_WESTERN = {
        'DO': 'C', 'RE': 'D', 'MI': 'E', 'FA': 'F', 'SOL': 'G', 'LA': 'A', 'SI': 'B',
        'do': 'C', 're': 'D', 'mi': 'E', 'fa': 'F', 'sol': 'G', 'la': 'A', 'si': 'B'
    };

    const ACCIDENTAL_MAP = {
       '#': '#', '##': '##', // Sharp, Double Sharp
       'S': '#', 'SS': '##', // Sharp, Double Sharp (alternative)
       'B': 'b', 'BB': 'bb', // Flat, Double Flat
       'N': '' // Natural
    };

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
                currentItem = { descriptor: descriptor, notes: [] }; // Initialize notes as an empty array
                if (currentSection) {
                    currentSection.items.push(currentItem);
                } else {
                    // console.error("Descriptor found without Section: " + descriptor);
                    parsingErrors.push(`Error: Descriptor "[${descriptor}]" found without a parent Section.`);
                }
            } else { // Notes line
                if (currentItem) {
                    const parsedNotes = parseNotesString(trimmedLine);
                    if (currentItem.notes && Array.isArray(currentItem.notes)) {
                        // If notes are on multiple lines and already started as an array
                        currentItem.notes = currentItem.notes.concat(parsedNotes);
                    } else {
                        currentItem.notes = parsedNotes; // Initialize or overwrite if it was a string (now always array)
                    }
                } else {
                    // console.error("Notes found without a preceding descriptor: " + trimmedLine);
                    parsingErrors.push(`Error: Notes "${trimmedLine.substring(0, 30)}..." found without a preceding descriptor.`);
                }
            }
        });

        console.log("Parsed song data (with note objects):");
        // Using a custom replacer for JSON.stringify to avoid overly verbose output for notes in console
        const customReplacer = (key, value) => {
            if (key === "notes" && Array.isArray(value) && value.length > 5) {
                return `[Array of ${value.length} note objects]`
            }
            return value;
        }
        console.log(JSON.stringify(songData, customReplacer, 2));
        if (parsingErrors.length > 0) {
            console.warn("Parsing errors occurred:", parsingErrors);
        }

        // Call the display function, passing parsingErrors
        displaySongData(songData, parsingErrors);
    }

    const PITCH_TO_NOTE_NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    function getNoteNameFromPitch(pitchValue) {
        if (pitchValue <= 0) return 'Unknown';
        const octave = Math.floor(pitchValue / 12) - 1; // MIDI octave convention (C4 is middle C, octave 4)
        const noteIndex = pitchValue % 12;
        return PITCH_TO_NOTE_NAME[noteIndex] + octave;
    }
   
    function isBlackKeyByPitch(pitchValue) {
        if (pitchValue <= 0) return false; // Or handle as an error/unknown
        const noteIndex = pitchValue % 12;
        // C#, D#, F#, G#, A# are black keys
        return [1, 3, 6, 8, 10].includes(noteIndex);
    }

    function getNoteRange(notesArray) {
        if (!notesArray || notesArray.length === 0) {
            // Default range if no notes, e.g., C4 to C5
            return { minPitch: 60, maxPitch: 72 };
        }

        let minPitch = Infinity;
        let maxPitch = -Infinity;
        let validNotesFound = false;

        notesArray.forEach(note => {
            // Ensure pitchValue is a number and not the 'UNKNOWN' placeholder value (0 or some other sentinel)
            if (typeof note.pitchValue === 'number' && note.pitchValue > 0) { 
                if (note.pitchValue < minPitch) {
                    minPitch = note.pitchValue;
                }
                if (note.pitchValue > maxPitch) {
                    maxPitch = note.pitchValue;
                }
                validNotesFound = true;
            }
        });

        if (!validNotesFound) {
             // Default range if no valid notes, e.g., C4 to C5
            return { minPitch: 60, maxPitch: 72 }; 
        }
        return { minPitch, maxPitch };
    }

    function generateKeyboardSegment(minPitch, maxPitch, notesToPlay = []) {
        const keyboard = [];
        // Adjust if minPitch/maxPitch are invalid or represent no range
        if (minPitch === 0 && maxPitch === 0 && notesToPlay.length === 0) {
            minPitch = 60; // C4
            maxPitch = 71; // B4
        } else if (minPitch > maxPitch) {
            // If range is invalid, default to C4-B4 or a small segment based on minPitch
            const defaultMax = minPitch + 11; // One octave from minPitch
            maxPitch = Math.max(minPitch, defaultMax); // Ensure maxPitch is at least minPitch
            minPitch = (minPitch > 0) ? minPitch : 60; // Ensure minPitch is valid
            if (minPitch > maxPitch) maxPitch = minPitch + 11; // Final check
        }
        
        const playedPitchValues = notesToPlay.map(n => n.pitchValue).filter(p => p > 0);

        for (let p = minPitch; p <= maxPitch; p++) {
            if (p <= 0) continue; // Skip invalid pitch values if range somehow includes them
            const key = {
                pitchValue: p,
                noteNameWithOctave: getNoteNameFromPitch(p),
                isBlackKey: isBlackKeyByPitch(p),
                isPlayed: playedPitchValues.includes(p)
            };
            keyboard.push(key);
        }
        return keyboard;
    }

    function parseNotesString(notesStr) {
        const notes = [];
        if (typeof notesStr !== 'string' || notesStr.trim() === '') {
            return notes;
        }

        const individualNoteStrings = notesStr.split(/[,\s]+/); // Split by comma or space

        individualNoteStrings.forEach(noteStr => {
            if (!noteStr.trim()) return;

            let westernNote;
            let octave = 4; // Default octave
            let accidental = '';
            let baseNoteName = '';
            let originalNoteStr = noteStr; // Keep original for the object

            // Try Solfege first
            let matchedSolfege = false;
            for (const solfegeBase in SOLFEGE_TO_WESTERN) {
                if (noteStr.toUpperCase().startsWith(solfegeBase.toUpperCase())) {
                    baseNoteName = SOLFEGE_TO_WESTERN[solfegeBase];
                    let rest = noteStr.substring(solfegeBase.length);
                    
                    const accidentalMatch = rest.match(/^(#|##|S|SS|B|BB|N)/i);
                    if (accidentalMatch) {
                        accidental = ACCIDENTAL_MAP[accidentalMatch[0].toUpperCase()] || '';
                        rest = rest.substring(accidentalMatch[0].length);
                    }
                    
                    const octaveMatch = rest.match(/(\d+)$/);
                    if (octaveMatch) {
                        octave = parseInt(octaveMatch[1], 10);
                        // Ensure octave is not NaN if parsing fails for some reason
                        if (isNaN(octave)) octave = 4; 
                    }
                    westernNote = baseNoteName + accidental;
                    matchedSolfege = true;
                    break;
                }
            }

            // If not Solfege, try ABCDEFG
            if (!matchedSolfege) {
                const abcMatch = noteStr.match(/^([A-G])(#{1,2}|b{1,2}|S{1,2}|B{1,2}|N)?(\d+)?/i);
                if (abcMatch) {
                    baseNoteName = abcMatch[1].toUpperCase();
                    accidental = ACCIDENTAL_MAP[(abcMatch[2] || '').toUpperCase()] || '';
                    westernNote = baseNoteName + accidental;
                    if (abcMatch[3]) { // Octave number
                        octave = parseInt(abcMatch[3], 10);
                         if (isNaN(octave)) octave = 4;
                    }
                } else {
                    console.warn(`Unrecognized note format: ${originalNoteStr}`);
                    notes.push({ original: originalNoteStr, westernFull: 'UNKNOWN', baseWestern: 'N/A', accidental: '', octave: 0, pitchValue: 0, isUnknown: true });
                    return; 
                }
            }
            
            if (westernNote && baseNoteName) { // Ensure baseNoteName is valid
                 const basePitchValues = { 
                    'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 
                };
                // Ensure baseNoteName is in basePitchValues (e.g. if parsing somehow failed)
                if (basePitchValues.hasOwnProperty(baseNoteName)) {
                    let pitchValue = basePitchValues[baseNoteName] + (octave * 12);
                    
                    // Correct calculation for double sharps/flats
                    if (accidental === '#') pitchValue += 1;
                    else if (accidental === '##') pitchValue += 2;
                    else if (accidental === 'b') pitchValue -= 1;
                    else if (accidental === 'bb') pitchValue -= 2;

                    notes.push({
                        original: originalNoteStr,
                        westernFull: westernNote, 
                        baseWestern: baseNoteName, 
                        accidental: accidental, 
                        octave: octave,
                        pitchValue: pitchValue 
                    });
                } else {
                     console.warn(`Invalid base note name after parsing: ${baseNoteName} from ${originalNoteStr}`);
                     notes.push({ original: originalNoteStr, westernFull: 'ERROR', baseWestern: baseNoteName, accidental: accidental, octave: octave, pitchValue: 0 });
                }
            } else {
                 console.warn(`Could not determine western note for: ${originalNoteStr}`);
                 notes.push({ original: originalNoteStr, westernFull: 'UNKNOWN', baseWestern: '', accidental: '', octave: 0, pitchValue: 0, isUnknown: true });
            }
        });
        return notes;
    }

    function displaySongData(songData, parsingErrors = []) {
        const songOutput = document.getElementById('songOutput');
        if (!songOutput) {
            console.error("Song output element not found for display!");
            return;
        }
        songOutput.innerHTML = ''; // Clear previous content
        // window.keyboardTestDone = false; // Removed: Test flag no longer needed

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

                            if (item.notes && item.notes.length > 0) {
                                renderPianoKeyboard(item.notes, itemDiv); // New call to render piano
                            } else {
                                // Optional: if there are no notes, maybe display a placeholder or nothing
                                const noNotesMsg = document.createElement('p');
                                noNotesMsg.textContent = '(No notes provided for this item)';
                                noNotesMsg.className = 'no-notes-message'; // For potential styling
                                itemDiv.appendChild(noNotesMsg);
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

    function renderPianoKeyboard(notesArray, containerElement) {
       if (!notesArray || notesArray.length === 0) {
           // containerElement.textContent = 'No notes for keyboard.'; // Already handled by no-notes-message
           return;
       }

       const unknownNotes = notesArray.filter(note => note.isUnknown);
       if (unknownNotes.length > 0) {
           const warningEl = document.createElement('p');
           warningEl.className = 'unknown-notes-warning';
           warningEl.textContent = `Warning: Contains ${unknownNotes.length} unrecognized note(s): ${unknownNotes.map(n=>n.original).join(', ')}. These will not be displayed on the keyboard.`;
           // Prepend warning so it's visible before the keyboard
           containerElement.insertBefore(warningEl, containerElement.firstChild); 
       }

       const validNotesForRangeAndSegment = notesArray.filter(note => !note.isUnknown);

       if (validNotesForRangeAndSegment.length === 0) {
           // If all notes were unknown, there's nothing to display on the keyboard.
           // The warning above is already shown.
           return;
       }

       const noteRange = getNoteRange(validNotesForRangeAndSegment);
       let minPitch = noteRange.minPitch;
       let maxPitch = noteRange.maxPitch;
       
       if ((maxPitch - minPitch) > 36) { // More than 3 octaves span
           console.warn(`Large pitch range detected (${getNoteNameFromPitch(minPitch)} to ${getNoteNameFromPitch(maxPitch)}) for item. Keyboard might be very wide.`);
       }

       // Ensure a minimum visual span, e.g., at least 12 semitones (1 octave)
       if ((maxPitch - minPitch + 1) < 12) {
           const center = Math.round((minPitch + maxPitch) / 2);
           minPitch = center - 6;
           maxPitch = center + 5; 
           minPitch = Math.max(21, minPitch); 
           maxPitch = Math.max(minPitch + 11, maxPitch);
       }

       const keyboardSegment = generateKeyboardSegment(minPitch, maxPitch, validNotesForRangeAndSegment);

       const keyboardWrapper = document.createElement('div');
       keyboardWrapper.className = 'piano-keyboard-wrapper';

       const whiteKeysContainer = document.createElement('div');
       whiteKeysContainer.className = 'white-keys-container';
       
       const blackKeysContainer = document.createElement('div');
       blackKeysContainer.className = 'black-keys-container';

       let whiteKeyRenderCount = 0; // Use a new counter for actual rendered white keys

       keyboardSegment.forEach(keyData => {
           const keyElement = document.createElement('div');
           // Basic class, will add white/black specific ones later
           keyElement.className = 'piano-key'; 
           if (keyData.isPlayed) {
                // General played class, specific color handled by white/black played classes in CSS
                // keyElement.classList.add('played'); // Not strictly needed if CSS handles played-key and played-black-key
           }
           keyElement.dataset.pitch = keyData.pitchValue;
           keyElement.dataset.noteName = keyData.noteNameWithOctave;
           keyElement.title = keyData.noteNameWithOctave; // Tooltip for note name

           if (keyData.isBlackKey) {
               keyElement.classList.add('black-key');
               if (keyData.isPlayed) keyElement.classList.add('played-black-key');
            
               const whiteKeyWidth = 30; // px, from CSS
               const blackKeyWidth = 20; // px, from CSS
               // Position black key relative to the start of the *previous* white key's space
               keyElement.style.position = 'absolute'; 
               // whiteKeyRenderCount is the count of white keys *before* this black key's logical position
               keyElement.style.left = (whiteKeyRenderCount * whiteKeyWidth) - (blackKeyWidth / 2) + 'px';
            
               blackKeysContainer.appendChild(keyElement);
           } else {
               keyElement.classList.add('white-key');
               if (keyData.isPlayed) keyElement.classList.add('played-key');
               whiteKeysContainer.appendChild(keyElement);
               whiteKeyRenderCount++; // Increment for each white key added to DOM
           }
       });
       
       keyboardWrapper.appendChild(whiteKeysContainer);
       keyboardWrapper.appendChild(blackKeysContainer);
       containerElement.appendChild(keyboardWrapper);
   }
});
