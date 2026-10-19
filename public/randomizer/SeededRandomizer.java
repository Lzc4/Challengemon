import com.dabomstew.pkrandom.FileFunctions;
import com.dabomstew.pkrandom.RandomSource;
import com.dabomstew.pkrandom.Randomizer;
import com.dabomstew.pkrandom.Settings;
import com.dabomstew.pkrandom.romhandlers.Gen1RomHandler;
import com.dabomstew.pkrandom.romhandlers.Gen2RomHandler;
import com.dabomstew.pkrandom.romhandlers.Gen3RomHandler;
import com.dabomstew.pkrandom.romhandlers.Gen4RomHandler;
import com.dabomstew.pkrandom.romhandlers.Gen5RomHandler;
import com.dabomstew.pkrandom.romhandlers.RomHandler;

import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.ResourceBundle;

public class SeededRandomizer {
    public static void main(String[] args) throws Exception {
        // aufraeumen fuer cheerpj
        if (args.length == 2 && args[0].equals("--delete")) {
            new java.io.File(args[1]).delete();
            return;
        }
        if (args.length < 4) {
            System.err.println("usage: SeededRandomizer <settings.rnqs> <input> <output> <seed> [log]");
            System.exit(2);
        }
        Settings settings;
        try (FileInputStream fis = new FileInputStream(args[0])) {
            settings = Settings.read(fis);
        }
        settings.setCustomNames(FileFunctions.getCustomNames());
        RomHandler.Factory[] factories = {
            new Gen1RomHandler.Factory(), new Gen2RomHandler.Factory(), new Gen3RomHandler.Factory(),
            new Gen4RomHandler.Factory(), new Gen5RomHandler.Factory()
        };
        RomHandler handler = null;
        for (RomHandler.Factory f : factories) {
            if (f.isLoadable(args[1])) {
                handler = f.create(RandomSource.instance());
                handler.loadRom(args[1]);
                break;
            }
        }
        if (handler == null) {
            System.err.println("ROM not supported");
            System.exit(3);
        }
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PrintStream log = new PrintStream(baos, false, "UTF-8");
        ResourceBundle bundle = ResourceBundle.getBundle("com/dabomstew/pkrandom/newgui/Bundle");
        Randomizer randomizer = new Randomizer(settings, handler, bundle, false);
        // wie CliRandomizer, nur mit festem seed
        randomizer.randomize(args[2], log, Long.parseLong(args[3]));
        log.close();
        if (args.length > 4) {
            try (FileOutputStream fos = new FileOutputStream(args[4])) {
                fos.write(baos.toByteArray());
            }
        }
        System.out.println("OK " + new String(baos.toByteArray(), StandardCharsets.UTF_8).length());
    }
}
