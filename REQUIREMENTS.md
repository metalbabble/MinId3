## MinId3

This is a cross-platform (Electron) minimal ID3 editor "MinId3" which allows the ID3 tags of MP3 files to be set.

# Primary features
- Interface to set common ID3 tags including album art
- Ability to bulk edit a set of MP3s

# Supported ID3 tags that can be edited:
- Title
- Artist
- Album
- Year
- Track number
- Genre
- Comment
- Album art (image file)

# UI

When no file is open, the UI is empty with a message "Click here to open (or drag files here)" centered in the middle. As the text suggests, clicking the link shows a file selection dialog to open valid music files. The UI allows drag and drop: either a single music file, a set, or a folder containing music files.

A user can also drag a folder or music file(s) to the MinId3 icon to open them.

When MP3 files are open in the application, the UI shows two main areas. On the left is a scrollable list titled "Current Files" (which are the current open files being edited). Each file shows a checkbox to indicate if the edits apply to the current file. By default, when music files are opened they start of checked. At the bottom of the list are two buttons: "Add file" or "Close File". Add file re-opens the file selection dialog and supports adding addition music files to the active "Current Files" list. The "Close File" button removes checked files from the list. If no files are checked, this button is disabled.

The right side is the list of ID3 tags to be edited. The list of possible fields is captured earlier in this document. The field values are pre-populated with ID3 data from the select file or files on the "Current File" list. If all of the files have the same value (such as the artist name being the same) display the text. If multiple files are selected and they have different values (like song names), display placeholder text "(Multiple values)". A user can type into the field and then that value entered would get apply to all selected files.
Under the fields is a "Apply changes to x file(s)" button that commits the ID3 tag changes to any selected files in the "Current Files" list.

If a user makes changes, does not apply the changes, and attempts to select new files in the "Current Files" control, first warn the user they will lose unapplied changes, and then reset the fields from the tag content in the files.

The album art is shown in a square thumbnail. There is a link under it to "Select album art" which opens a file chooser to select a valid image file to use as new album art. Otherwise it should behave like other tags: when files are opened it shows the current art, if multiple are open using the same art it is shown. If muliple files are selected with different album art, the thumbnail box shows "Multiple values" but can be set once and applied.

# Builds

This application has builds targeting:
- Linux (x86 64 and ARM)
- macOS (ARM)
- Windows (x86 64)